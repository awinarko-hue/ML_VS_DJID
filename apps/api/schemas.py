"""
Pydantic schemas and validators for request/response contracts.
"""

from __future__ import annotations

import re
from datetime import date, datetime
from typing import Any
from pydantic import BaseModel, ConfigDict, Field, field_validator


class ScrapedListingRow(BaseModel):
    """Validator untuk setiap baris masukan CSV scraper marketplace."""
    web_scraper_order: str | None = None
    web_scraper_start_url: str | None = None
    data: str | None = None  # Harga mentah
    data2: str  # Judul produk mentah (wajib)
    data3: str | None = None  # Promo badge
    image: str | None = None  # Image URL

    @field_validator("data2")
    @classmethod
    def validate_title(cls, v: str) -> str:
        if not v or len(str(v).strip()) < 3:
            raise ValueError("Judul listing (data2) kosong atau terlalu pendek (< 3 karakter)")
        return str(v).strip()

    def parse_price(self) -> int | None:
        if not self.data:
            return None
        clean_p = re.sub(r"[^\d]", "", str(self.data))
        return int(clean_p) if clean_p else None


class DjidRow(BaseModel):
    """Validator untuk setiap baris masukan DJID.csv."""
    nomor_sertifikat: str
    tanggal_terbit: str | None = None
    plg_id: int | None = None
    nama_pemohon: str | None = None
    nama_perangkat: str | None = None
    merk: str
    model: str
    nama_pemasaran: str | None = None
    negara: str | None = None

    @field_validator("nomor_sertifikat", "merk", "model")
    @classmethod
    def validate_required_strings(cls, v: str, info: Any) -> str:
        if not v or not str(v).strip() or str(v).strip().lower() == "nan":
            raise ValueError(f"Kolom {info.field_name} tidak boleh kosong pada data DJID")
        return str(v).strip()


class TriageSingleRequest(BaseModel):
    judul: str = Field(..., min_length=3, description="Judul listing marketplace untuk ditriase")


class TriageSingleResponse(BaseModel):
    judul: str
    brand_terdeteksi: str | None
    canonical_brand: str | None
    status: str
    reason: str
    keterangan: str
    max_prob: float
    n_exact_hit: int
    kandidat_terbaik: str | None
    sertifikat_terbaik: str | None
    snapshot_djid: str
    bukti_semantik: list[dict[str, Any]]
    bukti_eksak: list[dict[str, Any]]


class BrandAliasCreate(BaseModel):
    alias: str
    merk_kanonik: str
    sumber: str = "analyst_rule"


class BrandAliasResponse(BaseModel):
    id: str
    alias: str
    merk_kanonik: str
    sumber: str
    dibuat_oleh: str
    dibuat_pada: datetime

    model_config = ConfigDict(from_attributes=True)


class ReviewDecisionCreate(BaseModel):
    keputusan_manusia: str = Field(..., description="MATCH | NOT_MATCH_UNLISTED | AMBIGUOUS")
    entri_djid_terpilih_id: str | None = None
    catatan: str | None = None
    reviewer_id: str = "analyst"
    durasi_detik: int | None = None


class ListingBatchIngestRequest(BaseModel):
    """Payload masukan batch listing baik dari ekstensi browser maupun JSON upload."""
    source: str = "extension"
    auto_triage: bool = True
    items: list[dict[str, Any]]


class ListingManualCreate(BaseModel):
    """Payload masukan satu listing secara manual dari form UI."""
    judul: str = Field(..., min_length=3, description="Judul listing produk marketplace")
    harga: str | None = None
    platform: str = "tokopedia"
    nama_penjual: str | None = None
    url_produk: str | None = None
    auto_triage: bool = True


class ListingIngestResponse(BaseModel):
    """Respons hasil proses ingest listing baru."""
    success: bool
    batch_id: str
    total_received: int
    valid_listings: int
    quarantined: int
    total_listings_now: int
    triage_summary: dict[str, Any] | None = None

