"""
Unit tests for feature extraction and feature naming sets.
"""

from ertriage.features import extract_features, get_feature_names


def test_evaluable_features_set() -> None:
    names_prod = get_feature_names("production")
    assert len(names_prod) == 7
    assert "brand_match" in names_prod
    assert "model_in_title" in names_prod

    names_eval = get_feature_names("evaluable")
    assert len(names_eval) == 5
    assert "brand_match" not in names_eval
    assert "model_in_title" not in names_eval

    f_eval = extract_features(
        text_listing="Radio HT ICOM IC-V88 VHF",
        text_djid="icom ic-v88 radio portable",
        brand_listing="icom",
        brand_djid="icom",
        model_djid="IC-V88",
        cosine_sim=0.85,
        feature_set="evaluable",
    )
    assert len(f_eval) == 5
