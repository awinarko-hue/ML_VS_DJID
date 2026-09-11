"""
Unit tests for artifact loading and integrity verification.
"""

from pathlib import Path
import pytest

from ertriage.artifacts import (
    ArtifactIntegrityError,
    calculate_bytes_checksum,
    calculate_file_checksum,
    load_system,
)
from ertriage.config import KonfigurasiTriase


def test_checksum_utilities() -> None:
    data = b"SITRUS DJID TEST"
    c1 = calculate_bytes_checksum(data)
    assert len(c1) == 64
    assert c1 == calculate_bytes_checksum(data)


def test_load_system_with_real_artifacts() -> None:
    cfg = KonfigurasiTriase(
        path_djid=Path("Artefak/DJID.csv"),
        path_classifier=Path("Artefak/classifier_terbaik.pkl"),
        path_index=Path("Artefak/faiss_djid.index"),
        top_k=5,
    )
    sistem = load_system(cfg)
    assert sistem.df_djid is not None
    assert len(sistem.df_djid) == 1333
    assert sistem.index.ntotal == 1333

    # Tes inferensi satu listing
    hasil = sistem.triase("Radio HT ICOM IC-V88 VHF Walkie Talkie 5W Garansi Resmi")
    assert hasil.status in ["TERSERTIFIKASI", "PERLU_REVIEW", "TERINDIKASI_TIDAK_BERSERTIFIKAT"]
    assert len(hasil.bukti_semantik) == 5


def test_load_system_missing_file_raises_error() -> None:
    cfg = KonfigurasiTriase(
        path_djid=Path("non_existent_djid.csv"),
    )
    with pytest.raises(ArtifactIntegrityError):
        load_system(cfg)
