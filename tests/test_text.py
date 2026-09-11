"""
Unit tests for text processing and normalization utilities.
"""

from ertriage.text import build_djid_document, clean_text, normalize_model, remove_noise


def test_clean_text() -> None:
    assert clean_text("Radio HT ICOM IC-V88 VHF @5W!!") == "radio ht icom ic-v88 vhf 5w"
    assert clean_text("  BAOFENG    UV-5R  ") == "baofeng uv-5r"
    assert clean_text(None) == ""


def test_normalize_model() -> None:
    assert normalize_model("IC-V88") == "icv88"
    assert normalize_model("UV - 5R") == "uv5r"
    assert normalize_model("XiR P6600i") == "xirp6600i"
    assert normalize_model("NXR-1800") == "nxr1800"
    assert normalize_model(None) == ""


def test_remove_noise() -> None:
    raw = "Radio HT ICOM IC-V88 VHF Walkie Talkie 5W Garansi Resmi Original Termurah"
    cleaned = remove_noise(raw)
    assert "radio" not in cleaned.split()
    assert "ht" not in cleaned.split()
    assert "garansi" not in cleaned.split()
    assert "resmi" not in cleaned.split()
    assert "original" not in cleaned.split()
    assert "termurah" not in cleaned.split()
    assert "icom" in cleaned
    assert "ic-v88" in cleaned


def test_build_djid_document_variants() -> None:
    row = {
        "merk": "MOTOROLA",
        "model": "XiR P6600i",
        "nama_pemasaran": "MOTOROLA XiR P6600i UHF",
        "nama_perangkat": "Radio Portable / Two Way Radio",
    }
    doc_std = build_djid_document(row, variant="standard")
    assert "motorola" in doc_std
    assert "xir p6600i" in doc_std
    assert "radio portable two way radio" in doc_std

    doc_min = build_djid_document(row, variant="brand_model_only")
    assert doc_min == "motorola xir p6600i"

    doc_mkt = build_djid_document(row, variant="brand_model_marketing")
    assert "uhf" in doc_mkt

    doc_wt = build_djid_document(row, variant="weighted_model")
    assert "xir p6600i" in doc_wt
