"""
Configuration dataclasses, constants, and settings for SITRUS ertriage.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

# Parameter global tunggal
RANDOM_SEED: int = 42
MIN_MODEL_LENGTH: int = 3

# Noise words untuk judul marketplace
NOISE_WORDS: frozenset[str] = frozenset({
    "radio", "ht", "handy", "talky", "talkie", "walkie", "garansi", "resmi",
    "original", "ori", "murah", "promo", "terbaru", "baru", "free", "bonus",
    "paket", "termurah", "berkualitas", "tahun", "hemat", "pakai", "by",
    "dan", "dengan", "satu", "indonesia",
})

# Definisi fitur
FEATURES_PRODUCTION: tuple[str, ...] = (
    "cosine_sim",
    "levenshtein",
    "jaccard",
    "token_overlap",
    "length_diff",
    "brand_match",
    "model_in_title",
)

FEATURES_EVALUABLE: tuple[str, ...] = (
    "cosine_sim",
    "levenshtein",
    "jaccard",
    "token_overlap",
    "length_diff",
)

# Status Triase
STATUS_TERSERTIFIKASI: str = "TERSERTIFIKASI"
STATUS_PERLU_REVIEW: str = "PERLU_REVIEW"
STATUS_TERINDIKASI: str = "TERINDIKASI_TIDAK_BERSERTIFIKAT"

STATUS_BERSERTIFIKAT: str = STATUS_TERSERTIFIKASI
STATUS_PERLU_VERIFIKASI: str = STATUS_PERLU_REVIEW
STATUS_TERINDIKASI_TIDAK: str = STATUS_TERINDIKASI
STATUS_BUKAN_TELEKOMUNIKASI: str = "BUKAN_PERANGKAT_TELEKOMUNIKASI"

# Reason Codes
REASON_EXACT_MODEL_MATCH: str = "EXACT_MODEL_MATCH"
REASON_HIGH_PROB_MATCH: str = "HIGH_PROB_MATCH"
REASON_BRAND_TIDAK_TERDETEKSI: str = "BRAND_TIDAK_TERDETEKSI"
REASON_BRAND_TIDAK_ADA_DI_DJID: str = "BRAND_TIDAK_ADA_DI_DJID"
REASON_MEREK_ADA_MODEL_TIDAK_DITEMUKAN: str = "MEREK_ADA_MODEL_TIDAK_DITEMUKAN"
REASON_PROB_AMBIGU: str = "PROB_AMBIGU"

REASON_CODES: dict[str, str] = {
    REASON_EXACT_MODEL_MATCH: "Pencocokan model eksak ditemukan pada basis data DJID",
    REASON_HIGH_PROB_MATCH: "Probabilitas klasifikasi semantik tinggi (di atas ambang t_high)",
    REASON_BRAND_TIDAK_TERDETEKSI: "Merek perangkat tidak terdeteksi pada judul listing",
    REASON_BRAND_TIDAK_ADA_DI_DJID: "Merek terdeteksi tetapi tidak terdaftar sama sekali di basis data DJID",
    REASON_MEREK_ADA_MODEL_TIDAK_DITEMUKAN: "Merek terdaftar di DJID namun model tidak ditemukan pada sertifikasi",
    REASON_PROB_AMBIGU: "Skor probabilitas berada di zona ambigu (antara t_low dan t_high)",
}


@dataclass(frozen=True)
class KonfigurasiTriase:
    """Konfigurasi parameter sistem triase sertifikasi."""

    # Path artefak
    path_djid: Path = Path("Artefak/DJID.csv")
    path_classifier: Path = Path("Artefak/classifier_terbaik.pkl")
    path_index: Path = Path("Artefak/faiss_djid.index")
    dir_output: Path = Path("hasil_triase")

    # Model embedding
    nama_model_embedding: str = "paraphrase-multilingual-MiniLM-L12-v2"

    # Ambang keputusan
    t_high: float = 0.80
    t_low: float = 0.30

    # Retrieval
    top_k: int = 20
    min_panjang_model: int = MIN_MODEL_LENGTH

    # Fitur
    feature_names: tuple[str, ...] = FEATURES_PRODUCTION
    evaluable_feature_names: tuple[str, ...] = FEATURES_EVALUABLE

    # Seed
    random_seed: int = RANDOM_SEED

    # Tanggal snapshot DJID eksplisit (YYYY-MM-DD)
    tanggal_snapshot: str | None = None
