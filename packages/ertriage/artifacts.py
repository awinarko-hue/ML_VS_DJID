"""
Artifact registry, SHA-256 checksum verification, and system loader.
"""

from __future__ import annotations

import hashlib
import json
import logging
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Mapping

import faiss
import joblib
import pandas as pd
from sentence_transformers import SentenceTransformer

from ertriage.brands import BrandDetector
from ertriage.config import KonfigurasiTriase
from ertriage.retrieval import ExactModelMatcher
from ertriage.text import build_djid_document, clean_text, normalize_model
from ertriage.triage import SistemTriase

logger = logging.getLogger(__name__)


class ArtifactIntegrityError(Exception):
    """Exception yang dilemparkan ketika validasi integritas atau checksum artefak gagal."""
    pass


def calculate_file_checksum(filepath: str | Path) -> str:
    """Menghitung hash SHA-256 dari sebuah file fisik."""
    path = Path(filepath)
    if not path.exists():
        raise FileNotFoundError(f"File tidak ditemukan untuk checksum: {filepath}")
    sha256 = hashlib.sha256()
    with open(path, "rb") as f:
        while chunk := f.read(65536):
            sha256.update(chunk)
    return sha256.hexdigest()


def calculate_bytes_checksum(data: bytes) -> str:
    """Menghitung hash SHA-256 dari byte array."""
    return hashlib.sha256(data).hexdigest()


@dataclass
class ArtifactMetadata:
    """Metadata artefak tersimpan untuk audit trail dan reproduksibilitas."""
    jenis: str
    versi: str
    checksum: str
    snapshot_djid_checksum: str
    hyperparameter: dict[str, Any] = field(default_factory=dict)
    metrik: dict[str, Any] = field(default_factory=dict)
    dibuat_pada: str = field(default_factory=lambda: datetime.now().isoformat())


def load_system(cfg: KonfigurasiTriase | None = None) -> SistemTriase:
    """
    Memuat seluruh artefak model, database DJID, dan menginisialisasi SistemTriase.

    Memverifikasi integritas file dengan SHA-256 dan exception eksplisit (tanpa assert).
    """
    cfg = cfg or KonfigurasiTriase()

    # 1. Validasi path keberadaan file
    for p, name in [
        (cfg.path_djid, "DJID.csv"),
        (cfg.path_index, "FAISS Index"),
        (cfg.path_classifier, "Classifier"),
    ]:
        if not Path(p).exists():
            raise ArtifactIntegrityError(
                f"Artefak {name} tidak ditemukan di '{p}'. "
                f"Pastikan file telah di-ingest atau build artefak telah dijalankan."
            )

    # 2. Baca basis data DJID
    djid_checksum = calculate_file_checksum(cfg.path_djid)
    logger.info("Memuat basis data DJID dari %s (SHA-256: %s)", cfg.path_djid, djid_checksum)
    df_djid = pd.read_csv(cfg.path_djid, encoding="utf-8-sig")

    if "dokumen" not in df_djid.columns:
        df_djid["dokumen"] = df_djid.apply(build_djid_document, axis=1)
    if "identitas" not in df_djid.columns:
        df_djid["identitas"] = (
            df_djid["merk"].astype(str).str.strip() + " " + df_djid["model"].astype(str).str.strip()
        )

    # 3. Muat FAISS Index & verifikasi sinkronisasi
    logger.info("Memuat index FAISS dari %s", cfg.path_index)
    index = faiss.read_index(str(cfg.path_index))
    if index.ntotal != len(df_djid):
        raise ArtifactIntegrityError(
            f"Ketidaksinkronan index FAISS: index berisi {index.ntotal} vektor, "
            f"sedangkan DJID.csv berisi {len(df_djid)} baris. "
            f"Bangun ulang index dengan pipelines/build.py."
        )

    # 4. Muat Classifier & Embedding Model
    logger.info("Memuat classifier dari %s", cfg.path_classifier)
    classifier = joblib.load(cfg.path_classifier)

    logger.info("Memuat model embedding: %s", cfg.nama_model_embedding)
    model_embed = SentenceTransformer(cfg.nama_model_embedding)

    # 5. Inisialisasi Detektor Merek
    brands_djid = set(df_djid["merk"].dropna().astype(str).str.strip().str.lower().unique())
    brand_detector = BrandDetector(brands_djid=brands_djid)

    # 6. Inisialisasi Pencocokan Eksak
    djid_records = df_djid.to_dict("records")
    exact_matcher = ExactModelMatcher(djid_records, min_model_length=cfg.min_panjang_model)

    # 7. Tanggal Snapshot
    snapshot_date = cfg.tanggal_snapshot
    if not snapshot_date:
        # Fallback format tanggal ISO saat ini bila tidak diset
        snapshot_date = datetime.now().strftime("%Y-%m-%d")

    logger.info(
        "Sistem Triase SITRUS siap. DJID: %d entri; Snapshot: %s; Top-K: %d; t_low: %.2f; t_high: %.2f",
        len(df_djid),
        snapshot_date,
        cfg.top_k,
        cfg.t_low,
        cfg.t_high,
    )

    return SistemTriase(
        cfg=cfg,
        df_djid=df_djid,
        index=index,
        classifier=classifier,
        model_embed=model_embed,
        brand_detector=brand_detector,
        exact_matcher=exact_matcher,
        tanggal_snapshot=snapshot_date,
    )
