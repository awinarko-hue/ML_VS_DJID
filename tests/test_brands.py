"""
Unit tests for brand detection and alias resolution.
"""

from ertriage.brands import BrandDetector


def test_brand_detection_canonical_in_djid() -> None:
    detector = BrandDetector(brands_djid=["baofeng", "icom", "motorola"])
    res = detector.detect("Radio HT ICOM IC-V88 VHF Walkie Talkie")
    assert res.raw_match == "icom"
    assert res.canonical_brand == "icom"
    assert res.is_in_djid is True
    assert res.is_known_market is True


def test_brand_alias_resolution_pofung() -> None:
    detector = BrandDetector(
        brands_djid=["baofeng", "icom", "motorola"],
        aliases={"pofung": "baofeng"},
    )
    res = detector.detect("HT Pofung UV-5R Dual Band Murah")
    assert res.raw_match == "pofung"
    assert res.canonical_brand == "baofeng"
    assert res.is_in_djid is True
    assert res.is_known_market is True


def test_brand_update_aliases() -> None:
    detector = BrandDetector(brands_djid=["motorola"])
    detector.update_aliases({"magone": "motorola"})
    res = detector.detect("Radio Magone VZ-28 UHF")
    assert res.canonical_brand == "motorola"
    assert res.is_in_djid is True


def test_brand_unlisted_in_djid() -> None:
    detector = BrandDetector(
        brands_djid=["motorola", "icom"],
        brands_market=["quansheng", "tyt"],
    )
    res = detector.detect("Walkie Talkie Quansheng UV-K5 Dual Band")
    assert res.raw_match == "quansheng"
    assert res.canonical_brand == "quansheng"
    assert res.is_in_djid is False
    assert res.is_known_market is True


def test_brand_not_detected() -> None:
    detector = BrandDetector(brands_djid=["motorola", "icom"])
    res = detector.detect("Walkie Talkie 5W Output Power IP67 Garansi Resmi")
    assert res.raw_match is None
    assert res.canonical_brand == None
    assert res.is_in_djid is False
    assert res.is_known_market is False


def test_brand_empty_detector() -> None:
    detector = BrandDetector(brands_djid=[], brands_market=[], aliases={})
    assert detector.detect("Any text").raw_match is None
