"""
Triage decision engine and business logic.
"""

from __future__ import annotations

import logging
from dataclasses import asdict, dataclass, field
from typing import Any, Mapping, Sequence

import numpy as np
import pandas as pd

from ertriage.brands import BrandDetector
from ertriage.config import (
    KonfigurasiTriase,
    REASON_BRAND_TIDAK_ADA_DI_DJID,
    REASON_BRAND_TIDAK_TERDETEKSI,
    REASON_EXACT_MODEL_MATCH,
    REASON_HIGH_PROB_MATCH,
    REASON_MEREK_ADA_MODEL_TIDAK_DITEMUKAN,
    REASON_PROB_AMBIGU,
    STATUS_PERLU_REVIEW,
    STATUS_TERINDIKASI,
    STATUS_TERSERTIFIKASI,
)
from ertriage.features import extract_features
from ertriage.retrieval import ExactMatchResult, ExactModelMatcher
from ertriage.text import clean_text

logger = logging.getLogger(__name__)


@dataclass
class TriageDecision:
    """Hasil evaluasi triase satu listing marketplace beserta audit trail lengkap."""
    judul: str
    brand_terdeteksi: str | None
    canonical_brand: str | None
    status: str
    reason: str
    keterangan: str
    max_prob: float
    n_exact_hit: int
    kandidat_terbaik: str | None
    sertifikat_terbaik: str | None
    snapshot_djid: str
    bukti_semantik: list[dict[str, Any]] = field(default_factory=list)
    bukti_eksak: list[dict[str, Any]] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


class SistemTriase:
    """
    Sistem Triase Sertifikasi Perangkat (Dual-path Retrieval + Gradient Boosting Decision Layer).
    """

    def __init__(
        self,
        cfg: KonfigurasiTriase,
        df_djid: pd.DataFrame,
        index: Any,  # faiss.Index
        classifier: Any,
        model_embed: Any,  # SentenceTransformer
        brand_detector: BrandDetector,
        exact_matcher: ExactModelMatcher,
        tanggal_snapshot: str,
    ) -> None:
        self.cfg = cfg
        self.df_djid = df_djid
        self.index = index
        self.classifier = classifier
        self.model_embed = model_embed
        self.brand_detector = brand_detector
        self.exact_matcher = exact_matcher
        self.tanggal_snapshot = tanggal_snapshot

    def kandidat_semantik(self, judul: str, detected_brand: str | None = None) -> pd.DataFrame:
        """Pencarian kandidat semantik via SBERT + FAISS dan skoring probabilitas classifier."""
        q_clean = clean_text(judul)
        q_emb = self.model_embed.encode([q_clean], normalize_embeddings=True).astype("float32")
        scores, idxs = self.index.search(q_emb, self.cfg.top_k)

        feats = []
        rows = []
        for rank in range(self.cfg.top_k):
            j = int(idxs[0][rank])
            row = self.df_djid.iloc[j]
            cosine_score = float(scores[0][rank])
            
            f_vec = extract_features(
                text_listing=judul,
                text_djid=row["dokumen"],
                brand_listing=detected_brand,
                brand_djid=str(row.get("merk", "")).strip().lower(),
                model_djid=str(row.get("model", "")),
                cosine_sim=cosine_score,
                feature_set="production",
            )
            feats.append(f_vec)
            rows.append({
                "rank": rank + 1,
                "idx_djid": j,
                "identitas": str(row.get("identitas", "")),
                "sertifikat": str(row.get("nomor_sertifikat", "")),
                "cosine": round(cosine_score, 4),
            })

        df_feats = pd.DataFrame(feats, columns=list(self.cfg.feature_names))
        proba = self.classifier.predict_proba(df_feats)[:, 1]

        out = pd.DataFrame(rows)
        out["prob_match"] = np.round(proba, 4)
        return out.sort_values("prob_match", ascending=False).reset_index(drop=True)

    def triase(self, judul: str) -> TriageDecision:
        """Klasifikasi status kepatuhan sertifikasi satu judul listing marketplace."""
        brand_res = self.brand_detector.detect(judul)
        detected_brand = brand_res.canonical_brand

        # 1. Jalur Eksak
        exact_hits = self.exact_matcher.match(judul, detected_brand=detected_brand)

        # 2. Jalur Semantik
        df_sem = self.kandidat_semantik(judul, detected_brand=detected_brand)
        max_prob = float(df_sem["prob_match"].max()) if not df_sem.empty else 0.0
        best_sem = df_sem.iloc[0] if not df_sem.empty else None

        bukti_semantik = df_sem.to_dict("records")
        bukti_eksak = [
            {
                "idx_djid": h.idx_djid,
                "identitas": h.identitas,
                "sertifikat": h.nomor_sertifikat,
                "model_norm": h.model_norm,
                "brand_djid": h.brand_djid,
            }
            for h in exact_hits
        ]

        # Inisialisasi default kandidat terbaik
        kandidat_terbaik = str(best_sem["identitas"]) if best_sem is not None else None
        sertifikat_terbaik = str(best_sem["sertifikat"]) if best_sem is not None else None

        # =====================================================================
        # LOGIKA KEPUTUSAN (URUTAN ATURAN DARI BUKTI TERKUAT)
        # =====================================================================

        # ATURAN 1: Exact model match ditemukan
        if len(exact_hits) > 0:
            top_exact = exact_hits[0]
            return TriageDecision(
                judul=judul,
                brand_terdeteksi=brand_res.raw_match,
                canonical_brand=detected_brand,
                status=STATUS_TERSERTIFIKASI,
                reason=REASON_EXACT_MODEL_MATCH,
                keterangan=(
                    f"Nomor model '{top_exact.model_norm}' ditemukan secara eksak di judul; "
                    f"Sertifikat: {top_exact.nomor_sertifikat}"
                ),
                max_prob=max_prob,
                n_exact_hit=len(exact_hits),
                kandidat_terbaik=top_exact.identitas,
                sertifikat_terbaik=top_exact.nomor_sertifikat,
                snapshot_djid=self.tanggal_snapshot,
                bukti_semantik=bukti_semantik,
                bukti_eksak=bukti_eksak,
            )

        # ATURAN 2: Probabilitas semantik tinggi (>= t_high)
        if max_prob >= self.cfg.t_high:
            return TriageDecision(
                judul=judul,
                brand_terdeteksi=brand_res.raw_match,
                canonical_brand=detected_brand,
                status=STATUS_TERSERTIFIKASI,
                reason=REASON_HIGH_PROB_MATCH,
                keterangan=f"prob_match={max_prob:.3f} >= ambang t_high ({self.cfg.t_high:.2f})",
                max_prob=max_prob,
                n_exact_hit=0,
                kandidat_terbaik=kandidat_terbaik,
                sertifikat_terbaik=sertifikat_terbaik,
                snapshot_djid=self.tanggal_snapshot,
                bukti_semantik=bukti_semantik,
                bukti_eksak=bukti_eksak,
            )

        # ATURAN 3: Merek tidak terdeteksi sama sekali di teks listing
        if brand_res.raw_match is None:
            return TriageDecision(
                judul=judul,
                brand_terdeteksi=None,
                canonical_brand=None,
                status=STATUS_PERLU_REVIEW,
                reason=REASON_BRAND_TIDAK_TERDETEKSI,
                keterangan="Judul listing tidak memuat merek perangkat yang dikenal; memerlukan verifikasi manual.",
                max_prob=max_prob,
                n_exact_hit=0,
                kandidat_terbaik=kandidat_terbaik,
                sertifikat_terbaik=sertifikat_terbaik,
                snapshot_djid=self.tanggal_snapshot,
                bukti_semantik=bukti_semantik,
                bukti_eksak=bukti_eksak,
            )

        # ATURAN 4: Merek dikenal di pasar tetapi tidak terdaftar di DJID
        if brand_res.is_known_market and not brand_res.is_in_djid:
            return TriageDecision(
                judul=judul,
                brand_terdeteksi=brand_res.raw_match,
                canonical_brand=detected_brand,
                status=STATUS_TERINDIKASI,
                reason=REASON_BRAND_TIDAK_ADA_DI_DJID,
                keterangan=(
                    f"Merek '{detected_brand}' terdeteksi di pasar namun tidak terdaftar pada "
                    f"basis data DJID per {self.tanggal_snapshot}."
                ),
                max_prob=max_prob,
                n_exact_hit=0,
                kandidat_terbaik=kandidat_terbaik,
                sertifikat_terbaik=sertifikat_terbaik,
                snapshot_djid=self.tanggal_snapshot,
                bukti_semantik=bukti_semantik,
                bukti_eksak=bukti_eksak,
            )

        # ATURAN 5: Merek ada di DJID tetapi model tidak cocok (prob < t_low & no exact match)
        if max_prob < self.cfg.t_low:
            return TriageDecision(
                judul=judul,
                brand_terdeteksi=brand_res.raw_match,
                canonical_brand=detected_brand,
                status=STATUS_TERINDIKASI,
                reason=REASON_MEREK_ADA_MODEL_TIDAK_DITEMUKAN,
                keterangan=(
                    f"Merek '{detected_brand}' terdaftar di DJID, namun tidak ditemukan kandidat model "
                    f"dengan prob >= {self.cfg.t_low:.2f} dan tidak ada kecocokan eksak model."
                ),
                max_prob=max_prob,
                n_exact_hit=0,
                kandidat_terbaik=kandidat_terbaik,
                sertifikat_terbaik=sertifikat_terbaik,
                snapshot_djid=self.tanggal_snapshot,
                bukti_semantik=bukti_semantik,
                bukti_eksak=bukti_eksak,
            )

        # ATURAN 6: Probabilitas ambigu (zona abu-abu [t_low, t_high))
        return TriageDecision(
            judul=judul,
            brand_terdeteksi=brand_res.raw_match,
            canonical_brand=detected_brand,
            status=STATUS_PERLU_REVIEW,
            reason=REASON_PROB_AMBIGU,
            keterangan=(
                f"prob_match={max_prob:.3f} berada pada zona ambiguitas "
                f"[{self.cfg.t_low:.2f}, {self.cfg.t_high:.2f}); memerlukan peninjauan analis."
            ),
            max_prob=max_prob,
            n_exact_hit=0,
            kandidat_terbaik=kandidat_terbaik,
            sertifikat_terbaik=sertifikat_terbaik,
            snapshot_djid=self.tanggal_snapshot,
            bukti_semantik=bukti_semantik,
            bukti_eksak=bukti_eksak,
        )

    def triase_batch(self, judul_list: Sequence[str]) -> list[TriageDecision]:
        """Triase kumpulan listing sekaligus dengan logging terstruktur."""
        logger.info("Memulai batch triase untuk %d listing", len(judul_list))
        results = [self.triase(str(j)) for j in judul_list]
        logger.info("Batch triase selesai (%d hasil)", len(results))
        return results

    def triage(self, judul: str) -> TriageDecision:
        """Alias untuk self.triase(judul)."""
        return self.triase(judul)

    def triage_batch(self, judul_list: Sequence[str]) -> list[TriageDecision]:
        """Alias untuk self.triase_batch(judul_list)."""
        return self.triase_batch(judul_list)

