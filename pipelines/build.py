"""
CLI Artifact Rebuild, Hybrid Indexing, and Classifier Training Pipeline.

Usage:
    python pipelines/build.py --djid Artefak/DJID.csv --listings Artefak/listing_marketplace.csv --output-dir Artefak
"""

from __future__ import annotations

import argparse
import hashlib
import json
import logging
import pickle
import sys
from pathlib import Path
from typing import Any

# Setup path
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))
if str(ROOT_DIR / "packages") not in sys.path:
    sys.path.insert(0, str(ROOT_DIR / "packages"))

import faiss
import joblib
import numpy as np
import pandas as pd
from rank_bm25 import BM25Okapi
from sentence_transformers import SentenceTransformer
from sklearn.dummy import DummyClassifier
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report, f1_score, precision_score, recall_score
from sklearn.model_selection import StratifiedGroupKFold

from ertriage.artifacts import calculate_file_checksum
from ertriage.brands import DEFAULT_BRAND_ALIASES, BrandDetector
from ertriage.config import (
    FEATURES_EVALUABLE,
    FEATURES_PRODUCTION,
    MIN_MODEL_LENGTH,
    RANDOM_SEED,
)
from ertriage.features import extract_features
from ertriage.retrieval import reciprocal_rank_fusion
from ertriage.text import build_djid_document, clean_text, normalize_model, remove_noise

logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger("build_pipeline")


def build_pipeline(
    path_djid: Path,
    path_listings: Path,
    output_dir: Path,
    doc_variant: str = "brand_model_marketing",
    embed_model_name: str = "paraphrase-multilingual-MiniLM-L12-v2",
) -> dict[str, Any]:
    """
    Eksekusi pipeline lengkap: Indexing, Retrieval Evaluation, Training Classifier & Artefak Versi.
    """
    output_dir.mkdir(parents=True, exist_ok=True)
    np.random.seed(RANDOM_SEED)

    # 1. Muat Dataset DJID
    logger.info("Membaca data DJID dari %s", path_djid)
    df_djid = pd.read_csv(path_djid, encoding="utf-8-sig")
    djid_checksum = calculate_file_checksum(path_djid)

    df_djid["merk_norm"] = df_djid["merk"].astype(str).str.strip().str.lower()
    df_djid["model_norm"] = df_djid["model"].apply(normalize_model)
    df_djid["dokumen"] = df_djid.apply(lambda r: build_djid_document(r, variant=doc_variant), axis=1)
    df_djid["identitas"] = df_djid["merk"].astype(str).str.strip() + " " + df_djid["model"].astype(str).str.strip()

    # 2. Muat Listings Marketplace
    logger.info("Membaca listing marketplace dari %s", path_listings)
    df_listing = pd.read_csv(path_listings, encoding="utf-8-sig")
    df_listing["judul_bersih"] = df_listing["data2"].apply(clean_text)
    df_listing["judul_inti"] = df_listing["data2"].apply(remove_noise)

    # Inisialisasi Detektor Merek
    brands_djid = set(df_djid["merk_norm"].dropna().unique())
    detector = BrandDetector(brands_djid=brands_djid, aliases=DEFAULT_BRAND_ALIASES)
    df_listing["brand_terdeteksi"] = df_listing["data2"].apply(lambda t: detector.detect(t).canonical_brand)

    # 3. Embedding & FAISS Indexing
    logger.info("Membuat dense embeddings dengan model '%s'...", embed_model_name)
    model_embed = SentenceTransformer(embed_model_name)
    emb_djid = model_embed.encode(
        df_djid["dokumen"].tolist(),
        normalize_embeddings=True,
        show_progress_bar=False,
    ).astype("float32")

    d_dim = emb_djid.shape[1]
    index_dense = faiss.IndexFlatIP(d_dim)
    index_dense.add(emb_djid)

    path_faiss = output_dir / "faiss_djid.index"
    faiss.write_index(index_dense, str(path_faiss))
    logger.info("Index FAISS disimpan ke %s (%d vektor)", path_faiss, index_dense.ntotal)

    # 4. Sparse Indexing (BM25)
    tokenized_corpus = [doc.split() for doc in df_djid["dokumen"].tolist()]
    bm25 = BM25Okapi(tokenized_corpus)

    # 5. Retrieval Listing
    logger.info("Menjalankan dense & hybrid retrieval untuk %d listing...", len(df_listing))
    emb_listing = model_embed.encode(
        df_listing["judul_bersih"].tolist(),
        normalize_embeddings=True,
        show_progress_bar=False,
    ).astype("float32")

    top_k = 20
    scores_dense, indices_dense = index_dense.search(emb_listing, top_k)

    # 6. Membangun Pasangan Kandidat dengan 3-Zone Labeling
    logger.info("Membangun pasangan kandidat dengan zona 3-nilai (1 / 0 / -1)...")
    pairs = []
    for i in range(len(df_listing)):
        listing_brand = df_listing.iloc[i]["brand_terdeteksi"]
        listing_title = df_listing.iloc[i]["data2"]
        listing_norm = normalize_model(listing_title)

        for rank in range(top_k):
            j = int(indices_dense[i][rank])
            row_djid = df_djid.iloc[j]
            djid_brand = row_djid["merk_norm"]
            djid_model_norm = row_djid["model_norm"]
            cosine_score = float(scores_dense[i][rank])

            brand_same = (listing_brand is not None) and (listing_brand == djid_brand)
            model_in_title = (len(djid_model_norm) >= MIN_MODEL_LENGTH) and (djid_model_norm in listing_norm)

            # Heuristik 3-Zone Labeling yang ketat:
            if brand_same and model_in_title:
                label = 1  # Positif kuat
            elif listing_brand is not None and not brand_same:
                label = 0  # Negatif kuat
            else:
                label = -1  # Ambigitas / Perlu review (Merek sama tapi model beda ATAU brand tidak terdeteksi)

            pairs.append({
                "idx_listing": i,
                "idx_djid": j,
                "rank": rank + 1,
                "judul_listing": listing_title,
                "identitas_djid": row_djid["identitas"],
                "cosine_faiss": cosine_score,
                "brand_listing": listing_brand,
                "brand_djid": djid_brand,
                "model_djid": row_djid["model"],
                "djid_dokumen": row_djid["dokumen"],
                "label": label,
            })

    df_pairs_all = pd.DataFrame(pairs)
    logger.info("Distribusi pasangan: Total=%d | Positif(1)=%d | Negatif(0)=%d | Dibuang(-1)=%d",
                len(df_pairs_all),
                (df_pairs_all["label"] == 1).sum(),
                (df_pairs_all["label"] == 0).sum(),
                (df_pairs_all["label"] == -1).sum())

    # Filter keluar label -1 dari dataset pelatihan
    df_labeled = df_pairs_all[df_pairs_all["label"] != -1].copy().reset_index(drop=True)
    logger.info("Dataset pelatihan bersih: %d pasangan kandidat", len(df_labeled))

    # Ekstraksi Fitur untuk Dataset Bersih
    X_prod_list = []
    X_eval_list = []
    for _, row in df_labeled.iterrows():
        f_p = extract_features(
            text_listing=row["judul_listing"],
            text_djid=row["djid_dokumen"],
            brand_listing=row["brand_listing"],
            brand_djid=row["brand_djid"],
            model_djid=row["model_djid"],
            cosine_sim=row["cosine_faiss"],
            feature_set="production",
        )
        f_e = extract_features(
            text_listing=row["judul_listing"],
            text_djid=row["djid_dokumen"],
            brand_listing=row["brand_listing"],
            brand_djid=row["brand_djid"],
            model_djid=row["model_djid"],
            cosine_sim=row["cosine_faiss"],
            feature_set="evaluable",
        )
        X_prod_list.append(f_p)
        X_eval_list.append(f_e)

    X_prod = pd.DataFrame(X_prod_list, columns=list(FEATURES_PRODUCTION))
    X_eval = pd.DataFrame(X_eval_list, columns=list(FEATURES_EVALUABLE))
    y = df_labeled["label"].values
    groups = df_labeled["idx_listing"].values

    # 7. Pelatihan dengan StratifiedGroupKFold
    sgkf = StratifiedGroupKFold(n_splits=5, shuffle=True, random_state=RANDOM_SEED)

    # Train Model Produksi (7 Fitur)
    clf_prod = RandomForestClassifier(
        n_estimators=200,
        max_depth=6,
        class_weight="balanced",
        random_state=RANDOM_SEED,
    )
    oof_preds_prod = np.zeros(len(df_labeled))
    oof_probs_prod = np.zeros(len(df_labeled))

    for train_idx, val_idx in sgkf.split(X_prod, y, groups=groups):
        clf_prod.fit(X_prod.iloc[train_idx], y[train_idx])
        oof_preds_prod[val_idx] = clf_prod.predict(X_prod.iloc[val_idx])
        oof_probs_prod[val_idx] = clf_prod.predict_proba(X_prod.iloc[val_idx])[:, 1]

    f1_prod = f1_score(y, oof_preds_prod, zero_division=0)
    rec_prod = recall_score(y, oof_preds_prod, zero_division=0)
    prec_prod = precision_score(y, oof_preds_prod, zero_division=0)
    logger.info("Model Produksi (7 Fitur) OOF: Prec=%.4f | Rec=%.4f | F1=%.4f", prec_prod, rec_prod, f1_prod)

    # Fit final model pada seluruh dataset berlabel
    clf_prod.fit(X_prod, y)
    path_clf_prod = output_dir / "classifier_terbaik.pkl"
    joblib.dump(clf_prod, path_clf_prod)

    # Train Model Evaluable (5 Fitur)
    clf_eval = RandomForestClassifier(
        n_estimators=200,
        max_depth=6,
        class_weight="balanced",
        random_state=RANDOM_SEED,
    )
    oof_preds_eval = np.zeros(len(df_labeled))
    oof_probs_eval = np.zeros(len(df_labeled))

    for train_idx, val_idx in sgkf.split(X_eval, y, groups=groups):
        clf_eval.fit(X_eval.iloc[train_idx], y[train_idx])
        oof_preds_eval[val_idx] = clf_eval.predict(X_eval.iloc[val_idx])
        oof_probs_eval[val_idx] = clf_eval.predict_proba(X_eval.iloc[val_idx])[:, 1]

    f1_eval = f1_score(y, oof_preds_eval, zero_division=0)
    rec_eval = recall_score(y, oof_preds_eval, zero_division=0)
    prec_eval = precision_score(y, oof_preds_eval, zero_division=0)
    logger.info("Model Evaluable (5 Fitur) OOF: Prec=%.4f | Rec=%.4f | F1=%.4f", prec_eval, rec_eval, f1_eval)

    path_clf_eval = output_dir / "classifier_evaluable.pkl"
    joblib.dump(clf_eval, path_clf_eval)

    # 8. Simpan Metadata Versi Artefak
    metadata = {
        "versi": "v1.0.0",
        "djid_checksum": djid_checksum,
        "djid_total_entries": len(df_djid),
        "random_seed": RANDOM_SEED,
        "doc_variant": doc_variant,
        "embedding_model": embed_model_name,
        "metrics": {
            "production_7_features": {
                "precision": round(float(prec_prod), 4),
                "recall": round(float(rec_prod), 4),
                "f1": round(float(f1_prod), 4),
            },
            "evaluable_5_features": {
                "precision": round(float(prec_eval), 4),
                "recall": round(float(rec_eval), 4),
                "f1": round(float(f1_eval), 4),
            },
        },
    }

    path_meta = output_dir / "metadata_rebuild.json"
    with open(path_meta, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)

    # Simpan manifest.json untuk verifikasi integritas artefak
    manifest = {
        "versi": "v1.0.0",
        "created_at": datetime.now().isoformat(),
        "artifacts": {
            "djid_csv": {
                "path": str(path_djid),
                "sha256": djid_checksum,
            },
            "faiss_index": {
                "path": str(path_index),
                "sha256": calculate_file_checksum(path_index),
            },
            "classifier_production": {
                "path": str(path_clf_prod),
                "sha256": calculate_file_checksum(path_clf_prod),
            },
            "classifier_evaluable": {
                "path": str(path_clf_eval),
                "sha256": calculate_file_checksum(path_clf_eval),
            },
        },
    }
    path_manifest = output_dir / "manifest.json"
    with open(path_manifest, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)

    logger.info("Rebuild artefak selesai. Seluruh artefak & manifest.json tersimpan di '%s'.", output_dir)
    return metadata


def main() -> None:
    parser = argparse.ArgumentParser(description="SITRUS Pipeline Build CLI")
    parser.add_argument("--djid", type=Path, default=Path("Artefak/DJID.csv"), help="Path ke DJID.csv")
    parser.add_argument("--listings", type=Path, default=Path("Artefak/listing_marketplace.csv"), help="Path ke listing_marketplace.csv")
    parser.add_argument("--output-dir", type=Path, default=Path("Artefak"), help="Direktori penyimpanan artefak")
    parser.add_argument("--doc-variant", type=str, default="brand_model_marketing", help="Varian pembentukan dokumen DJID")

    args = parser.parse_args()
    build_pipeline(args.djid, args.listings, args.output_dir, doc_variant=args.doc_variant)


if __name__ == "__main__":
    main()
