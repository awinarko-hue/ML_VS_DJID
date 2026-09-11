"""
Unit tests for data ingestion, schema validation, and quarantine handling.
"""

import tempfile
from datetime import date
from pathlib import Path
import pandas as pd
import pytest

from apps.api.database import Base, SessionLocal, engine
from apps.api.models import DjidEntry, DjidSnapshot, Listing, QuarantineListing, ScrapeBatch
from apps.api.schemas import DjidRow, ScrapedListingRow
from pipelines.ingest import ingest_djid, ingest_marketplace, init_db


@pytest.fixture(autouse=True)
def setup_test_db() -> None:
    init_db()


def test_djid_schema_validation_valid() -> None:
    row = DjidRow(
        nomor_sertifikat="122936/DJID/2026",
        tanggal_terbit="15 Jun 2026",
        plg_id=1889,
        nama_pemohon="PT CITRADATA PURNAKHARISMA",
        nama_perangkat="Radio Portable / Two Way Radio",
        merk="MOTOROLA",
        model="XiR P6600i",
        nama_pemasaran="MOTOROLA XiR P6600i UHF",
        negara="Malaysia",
    )
    assert row.merk == "MOTOROLA"
    assert row.model == "XiR P6600i"


def test_djid_schema_validation_invalid_empty_fields() -> None:
    with pytest.raises(Exception):
        DjidRow(
            nomor_sertifikat="",  # Empty not allowed
            merk="MOTOROLA",
            model="XiR P6600i",
        )


def test_scraped_listing_validation_and_price_parsing() -> None:
    valid_row = ScrapedListingRow(
        web_scraper_order="1782458402-1",
        web_scraper_start_url="https://tokopedia.com/shop/product",
        data="Rp2.950.000",
        data2="Radio HT ICOM IC-V88 VHF 5W",
        data3="Hemat 5%",
        image="https://images.tokopedia.net/img/product.jpg",
    )
    assert valid_row.parse_price() == 2950000

    # Test short title validation failure
    with pytest.raises(Exception):
        ScrapedListingRow(data2="HT")


def test_ingest_marketplace_with_quarantine() -> None:
    # Buat CSV sintetis berisi 1 baris valid dan 1 baris rusak
    with tempfile.NamedTemporaryFile("w", delete=False, suffix=".csv", encoding="utf-8") as f:
        f.write("web_scraper_order,web_scraper_start_url,data,data2,data3,image\n")
        f.write("1782458402-1,https://tokopedia.com/seller,Rp500.000,Radio HT Baofeng UV-5R Dual Band,,http://img.jpg\n")
        f.write("1782458402-2,https://tokopedia.com/seller,Rp100.000,a,,http://img.jpg\n")  # data2 terlalu pendek -> karantina
        temp_csv = Path(f.name)

    try:
        batch_id = ingest_marketplace(temp_csv, source_platform="tokopedia_test")
        db = SessionLocal()
        try:
            batch = db.query(ScrapeBatch).filter_by(id=batch_id).first()
            assert batch is not None
            assert len(batch.listings) == 1
            assert len(batch.quarantined) == 1
            assert "pendek" in batch.quarantined[0].alasan_penolakan.lower()
        finally:
            db.close()
    finally:
        temp_csv.unlink(missing_ok=True)
