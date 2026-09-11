"""
Unit tests for triage decision rules and reason codes coverage.
"""

from unittest.mock import MagicMock
import numpy as np
import pandas as pd
import pytest

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
from ertriage.retrieval import ExactModelMatcher
from ertriage.triage import SistemTriase


@pytest.fixture
def mock_sistem_triase() -> SistemTriase:
    cfg = KonfigurasiTriase(t_high=0.80, t_low=0.30, top_k=5)
    df_djid = pd.DataFrame([
        {
            "merk": "ICOM",
            "model": "IC-V88",
            "nomor_sertifikat": "95884/SDPPI/2023",
            "dokumen": "icom ic-v88 radio portable",
            "identitas": "ICOM IC-V88",
        },
        {
            "merk": "BAOFENG",
            "model": "UV-5R",
            "nomor_sertifikat": "51697/R/SDPPI/2018",
            "dokumen": "baofeng uv-5r dual band",
            "identitas": "BAOFENG UV-5R",
        },
    ])

    brand_detector = BrandDetector(
        brands_djid=["icom", "baofeng"],
        brands_market=["quansheng", "tyt"],
        aliases={"pofung": "baofeng"},
    )
    exact_matcher = ExactModelMatcher(df_djid.to_dict("records"), min_model_length=3)

    mock_index = MagicMock()
    mock_index.search.return_value = (np.array([[0.75, 0.70, 0.65, 0.60, 0.55]]), np.array([[0, 1, 0, 1, 0]]))

    mock_classifier = MagicMock()
    mock_embed = MagicMock()
    mock_embed.encode.return_value = np.zeros((1, 384), dtype="float32")

    return SistemTriase(
        cfg=cfg,
        df_djid=df_djid,
        index=mock_index,
        classifier=mock_classifier,
        model_embed=mock_embed,
        brand_detector=brand_detector,
        exact_matcher=exact_matcher,
        tanggal_snapshot="2026-06-15",
    )


def test_rule_1_exact_model_match(mock_sistem_triase: SistemTriase) -> None:
    mock_sistem_triase.classifier.predict_proba.return_value = np.array([[0.9, 0.1]] * 5)

    dec = mock_sistem_triase.triase("Radio HT ICOM IC-V88 VHF Garansi Resmi")
    assert dec.status == STATUS_TERSERTIFIKASI
    assert dec.reason == REASON_EXACT_MODEL_MATCH
    assert dec.sertifikat_terbaik == "95884/SDPPI/2023"
    assert dec.n_exact_hit > 0
    d_dict = dec.to_dict()
    assert d_dict["status"] == STATUS_TERSERTIFIKASI


def test_rule_2_high_prob_match(mock_sistem_triase: SistemTriase) -> None:
    mock_sistem_triase.classifier.predict_proba.return_value = np.array([[0.1, 0.85]] * 5)

    dec = mock_sistem_triase.triase("Radio HT Baofeng Walkie Talkie Seri Lima R")
    assert dec.status == STATUS_TERSERTIFIKASI
    assert dec.reason == REASON_HIGH_PROB_MATCH
    assert dec.max_prob >= 0.80


def test_rule_3_brand_not_detected(mock_sistem_triase: SistemTriase) -> None:
    mock_sistem_triase.classifier.predict_proba.return_value = np.array([[0.9, 0.1]] * 5)

    dec = mock_sistem_triase.triase("Radio Walkie Talkie 5W Garansi Resmi")
    assert dec.status == STATUS_PERLU_REVIEW
    assert dec.reason == REASON_BRAND_TIDAK_TERDETEKSI


def test_rule_4_brand_unlisted_in_djid(mock_sistem_triase: SistemTriase) -> None:
    mock_sistem_triase.classifier.predict_proba.return_value = np.array([[0.9, 0.1]] * 5)

    dec = mock_sistem_triase.triase("Radio HT Quansheng K5 Dual Band Airband")
    assert dec.status == STATUS_TERINDIKASI
    assert dec.reason == REASON_BRAND_TIDAK_ADA_DI_DJID
    assert "quansheng" in dec.keterangan.lower()
    assert "2026-06-15" in dec.keterangan


def test_rule_5_brand_in_djid_model_not_found(mock_sistem_triase: SistemTriase) -> None:
    mock_sistem_triase.classifier.predict_proba.return_value = np.array([[0.95, 0.05]] * 5)

    dec = mock_sistem_triase.triase("Radio HT ICOM XX-999 VHF Unik")
    assert dec.status == STATUS_TERINDIKASI
    assert dec.reason == REASON_MEREK_ADA_MODEL_TIDAK_DITEMUKAN
    assert dec.max_prob < 0.30


def test_rule_6_prob_ambiguous(mock_sistem_triase: SistemTriase) -> None:
    mock_sistem_triase.classifier.predict_proba.return_value = np.array([[0.5, 0.50]] * 5)

    dec = mock_sistem_triase.triase("Radio HT ICOM Seri Khusus Eksperimen")
    assert dec.status == STATUS_PERLU_REVIEW
    assert dec.reason == REASON_PROB_AMBIGU


def test_triase_batch(mock_sistem_triase: SistemTriase) -> None:
    mock_sistem_triase.classifier.predict_proba.return_value = np.array([[0.1, 0.85]] * 5)
    queries = [
        "Radio HT ICOM IC-V88 VHF Garansi Resmi",
        "Radio Walkie Talkie 5W Garansi Resmi",
    ]
    batch_res = mock_sistem_triase.triase_batch(queries)
    assert len(batch_res) == 2
    assert batch_res[0].status == STATUS_TERSERTIFIKASI
