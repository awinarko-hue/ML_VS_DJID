"""
Unit tests for exact matching and hybrid retrieval fusion.
"""

from ertriage.retrieval import ExactModelMatcher, reciprocal_rank_fusion


def test_exact_model_matcher() -> None:
    djid_sample = [
        {"merk": "ICOM", "model": "IC-V88", "nomor_sertifikat": "95884/SDPPI/2023", "identitas": "ICOM IC-V88"},
        {"merk": "BAOFENG", "model": "UV-5R", "nomor_sertifikat": "51697/R/SDPPI/2018", "identitas": "BAOFENG UV-5R"},
        {"merk": "MOTOROLA", "model": "XiR C2660", "nomor_sertifikat": "122716/DJID/2026", "identitas": "MOTOROLA XiR C2660"},
    ]

    matcher = ExactModelMatcher(djid_sample, min_model_length=3)

    # 1. Match ICOM IC-V88
    hits = matcher.match("Radio HT ICOM IC-V88 VHF Garansi Resmi", detected_brand="icom")
    assert len(hits) == 1
    assert hits[0].model_norm == "icv88"
    assert hits[0].nomor_sertifikat == "95884/SDPPI/2023"

    # 2. Match Baofeng UV-5R
    hits = matcher.match("HT Baofeng UV 5R Dual Band", detected_brand="baofeng")
    assert len(hits) == 1
    assert hits[0].model_norm == "uv5r"

    # 3. No match
    hits = matcher.match("Antena Mobil VHF High Gain", detected_brand=None)
    assert len(hits) == 0


def test_reciprocal_rank_fusion() -> None:
    dense_ranks = [10, 20, 30, 40]
    sparse_ranks = [20, 10, 50, 60]

    fused = reciprocal_rank_fusion(dense_ranks, sparse_ranks, k_rrf=60, top_k=3)
    doc_ids = [d[0] for d in fused]

    # Dokumen 10 dan 20 yang muncul di kedua list harus berada di posisi teratas
    assert 10 in doc_ids[:2]
    assert 20 in doc_ids[:2]
