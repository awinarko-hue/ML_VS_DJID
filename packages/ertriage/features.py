"""
Feature extraction module for training and inference parity.
"""

from __future__ import annotations

from typing import Any, Sequence

from ertriage.config import (
    FEATURES_PRODUCTION,
    FEATURES_EVALUABLE,
    MIN_MODEL_LENGTH,
)
from ertriage.text import clean_text, normalize_model

try:
    import Levenshtein
except ImportError:
    # Pure python fallback for ratio if Levenshtein is not yet compiled
    class _LevFallback:
        @staticmethod
        def ratio(s1: str, s2: str) -> float:
            if not s1 and not s2:
                return 1.0
            if not s1 or not s2:
                return 0.0
            # Standard sequence matcher ratio
            import difflib
            return difflib.SequenceMatcher(None, s1, s2).ratio()

    Levenshtein = _LevFallback()  # type: ignore


def extract_features(
    text_listing: Any,
    text_djid: Any,
    brand_listing: Any,
    brand_djid: Any,
    model_djid: Any,
    cosine_sim: float,
    feature_set: str = "production",
) -> list[float]:
    """
    Ekstraksi vektor fitur matematis dari satu pasangan (listing, entri DJID).

    Parameters
    ----------
    text_listing : Teks judul listing marketplace.
    text_djid : Dokumen teks entri DJID.
    brand_listing : Merek terdeteksi dari listing (atau None).
    brand_djid : Merek resmi dari entri DJID.
    model_djid : Nomor model dari entri DJID.
    cosine_sim : Skor kemiripan cosine dari tahap retrieval.
    feature_set : 'production' (7 fitur) atau 'evaluable' (5 fitur tanpa brand_match & model_in_title).

    Returns
    -------
    list[float] : Vektor fitur.
    """
    t1 = clean_text(text_listing)
    t2 = clean_text(text_djid)
    tok1 = set(t1.split())
    tok2 = set(t2.split())

    # 1. Cosine similarity
    f_cosine = float(cosine_sim)

    # 2. Levenshtein ratio (0.0 - 1.0)
    f_lev = float(Levenshtein.ratio(t1, t2))

    # 3. Jaccard similarity
    f_jaccard = float(len(tok1 & tok2) / len(tok1 | tok2)) if (tok1 | tok2) else 0.0

    # 4. Token overlap (dari sisi DJID)
    f_overlap = float(len(tok1 & tok2) / len(tok2)) if tok2 else 0.0

    # 5. Length difference (ternormalisasi)
    f_lendiff = float(abs(len(t1) - len(t2)) / max(len(t1), len(t2), 1))

    if feature_set == "evaluable":
        return [f_cosine, f_lev, f_jaccard, f_overlap, f_lendiff]

    # 6. Brand match (biner)
    f_brand = 1.0 if (
        brand_listing is not None
        and str(brand_listing).strip().lower() == str(brand_djid).strip().lower()
    ) else 0.0

    # 7. Model in title (biner)
    m_norm = normalize_model(model_djid)
    f_model = 1.0 if (
        len(m_norm) >= MIN_MODEL_LENGTH and m_norm in normalize_model(text_listing)
    ) else 0.0

    return [f_cosine, f_lev, f_jaccard, f_overlap, f_lendiff, f_brand, f_model]


def get_feature_names(feature_set: str = "production") -> tuple[str, ...]:
    """Mengembalikan daftar nama fitur berdasarkan konfigurasi."""
    if feature_set == "evaluable":
        return FEATURES_EVALUABLE
    return FEATURES_PRODUCTION
