"""
Golden test for feature parity between research notebook artifacts and ertriage package.
"""

from __future__ import annotations

from pathlib import Path
import numpy as np
import pandas as pd
import pytest

from ertriage.features import extract_features
from ertriage.text import build_djid_document


def test_feature_parity_with_notebook_dataset() -> None:
    """Memverifikasi bahwa extract_features menghasilkan vektor identik dengan dataset_fitur_final.csv."""
    djid_path = Path("Artefak/DJID.csv")
    pairs_path = Path("Artefak/pasangan_kandidat_final.csv")
    gold_features_path = Path("Artefak/dataset_fitur_final.csv")

    assert djid_path.exists(), f"File {djid_path} tidak ditemukan"
    assert pairs_path.exists(), f"File {pairs_path} tidak ditemukan"
    assert gold_features_path.exists(), f"File {gold_features_path} tidak ditemukan"

    df_djid = pd.read_csv(djid_path, encoding="utf-8-sig")
    df_djid["dokumen"] = df_djid.apply(build_djid_document, axis=1)

    df_pairs = pd.read_csv(pairs_path, encoding="utf-8-sig")
    df_gold = pd.read_csv(gold_features_path, encoding="utf-8-sig")

    assert len(df_pairs) == len(df_gold), "Jumlah baris pairs dan dataset fitur tidak cocok"

    feature_cols = [
        "cosine_sim",
        "levenshtein",
        "jaccard",
        "token_overlap",
        "length_diff",
        "brand_match",
        "model_in_title",
    ]

    for i, p in df_pairs.iterrows():
        row_djid = df_djid.iloc[int(p["idx_djid"])]
        brand_listing = p["brand_listing"] if pd.notna(p["brand_listing"]) else None

        extracted = extract_features(
            text_listing=p["judul_listing"],
            text_djid=row_djid["dokumen"],
            brand_listing=brand_listing,
            brand_djid=row_djid["merk"],
            model_djid=row_djid["model"],
            cosine_sim=p["cosine_faiss"],
            feature_set="production",
        )

        gold = df_gold.iloc[i][feature_cols].values.astype(float)
        np.testing.assert_allclose(
            np.array(extracted),
            gold,
            rtol=1e-5,
            atol=1e-5,
            err_msg=f"Ketidakcocokan fitur pada baris {i}: {p['judul_listing']}",
        )
