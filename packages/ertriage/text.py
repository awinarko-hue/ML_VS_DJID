"""
Text cleaning, normalization, and document formatting utilities.
"""

from __future__ import annotations

import re
from typing import Any, Mapping

from ertriage.config import NOISE_WORDS


def clean_text(text: Any) -> str:
    """Lowercase, hapus simbol non-alfanumerik (kecuali '-'), rapikan spasi."""
    text_str = str(text) if text is not None else ""
    text_str = text_str.lower()
    text_str = re.sub(r"[^a-z0-9\s\-]", " ", text_str)
    text_str = re.sub(r"\s+", " ", text_str).strip()
    return text_str


def normalize_model(m: Any) -> str:
    """Normalisasi nomor model ('IC-V88' -> 'icv88') untuk pencocokan string kanonikal."""
    if m is None:
        return ""
    return re.sub(r"[^a-z0-9]", "", str(m).lower())


def remove_noise(text: Any) -> str:
    """Hapus kata-kata pemasaran yang tidak informatif berdasarkan leksikon NOISE_WORDS."""
    cleaned = clean_text(text)
    tokens = [w for w in cleaned.split() if w not in NOISE_WORDS]
    return " ".join(tokens)


def build_djid_document(row: Mapping[str, Any], variant: str = "standard") -> str:
    """
    Gabungkan field entri DJID menjadi dokumen teks untuk indexing semantik/sparse.

    Varian:
    - 'standard': merk + model + nama_pemasaran + nama_perangkat
    - 'brand_model_only': merk + model
    - 'brand_model_marketing': merk + model + nama_pemasaran
    - 'weighted_model': merk + model + model + nama_pemasaran (memberikan bobot lebih pada model)
    """
    merk = str(row.get("merk", "") or "").strip()
    model = str(row.get("model", "") or "").strip()
    nama_pemasaran = str(row.get("nama_pemasaran", "") or "").strip()
    nama_perangkat = str(row.get("nama_perangkat", "") or "").strip()

    if variant == "brand_model_only":
        parts = [merk, model]
    elif variant == "brand_model_marketing":
        parts = [merk, model, nama_pemasaran]
    elif variant == "weighted_model":
        parts = [merk, model, model, nama_pemasaran]
    else:  # standard
        parts = [merk, model, nama_pemasaran, nama_perangkat]

    valid_parts = [p for p in parts if p and p.lower() != "nan"]
    doc = " ".join(valid_parts)
    return clean_text(doc)
