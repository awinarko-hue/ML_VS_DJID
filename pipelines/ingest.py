"""
CLI Ingestion Pipeline for DJID database and marketplace scraped listings.

Usage:
    python pipelines/ingest.py djid --file Artefak/DJID.csv --date 2026-06-15
    python pipelines/ingest.py marketplace --file Artefak/listing_marketplace.csv --source tokopedia
"""

from __future__ import annotations

import argparse
import hashlib
import logging
import sys
from datetime import date, datetime
from pathlib import Path

# Pastikan root workspace dan packages berada di sys.path
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))
if str(ROOT_DIR / "packages") not in sys.path:
    sys.path.insert(0, str(ROOT_DIR / "packages"))

import pandas as pd
from pydantic import ValidationError

from apps.api.database import Base, SessionLocal, engine
import apps.api.models as domain_models
from apps.api.models import (
    BrandAlias,
    DjidEntry,
    DjidSnapshot,
    Listing,
    QuarantineListing,
    ScrapeBatch,
)
from apps.api.schemas import DjidRow, ScrapedListingRow
from ertriage.artifacts import calculate_file_checksum
from ertriage.brands import DEFAULT_BRAND_ALIASES, BrandDetector
from ertriage.text import build_djid_document, clean_text, normalize_model, remove_noise

logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger("ingest_pipeline")


def init_db() -> None:
    """Inisialisasi tabel basis data jika belum ada."""
    Base.metadata.create_all(bind=engine)


def seed_brand_aliases(db: SessionLocal) -> None:
    """Seed tabel brand_alias default jika masih kosong."""
    existing_count = db.query(BrandAlias).count()
    if existing_count == 0:
        logger.info("Melakukan seeding default brand aliases...")
        for alias, canonical in DEFAULT_BRAND_ALIASES.items():
            db.add(BrandAlias(alias=alias, merk_kanonik=canonical, sumber="default_seed"))
        db.commit()
        logger.info("Seeding %d alias selesai.", len(DEFAULT_BRAND_ALIASES))


def ingest_djid(file_path: Path, snapshot_date: date | None = None, note: str = "") -> str:
    """
    Ingest basis data DJID.csv ke tabel djid_snapshot dan djid_entry.
    """
    init_db()
    db = SessionLocal()
    try:
        checksum = calculate_file_checksum(file_path)
        logger.info("File DJID: %s (SHA-256: %s)", file_path, checksum)

        existing_snapshot = db.query(DjidSnapshot).filter_by(checksum=checksum).first()
        if existing_snapshot:
            logger.info("Snapshot DJID dengan checksum ini sudah terdaftar (ID: %s).", existing_snapshot.id)
            return existing_snapshot.id

        df = pd.read_csv(file_path, encoding="utf-8-sig")
        logger.info("Membaca %d baris dari %s", len(df), file_path)

        snap_date = snapshot_date or date.today()
        snapshot = DjidSnapshot(
            tanggal_snapshot=snap_date,
            checksum=checksum,
            jumlah_entri=len(df),
            catatan=note or f"Ingested from {file_path.name}",
            dibuat_oleh="pipeline_ingest",
        )
        db.add(snapshot)
        db.flush()

        entries = []
        for idx, row in df.iterrows():
            row_dict = row.to_dict()
            try:
                valid_row = DjidRow(
                    nomor_sertifikat=str(row_dict.get("nomor_sertifikat", "")),
                    tanggal_terbit=str(row_dict.get("tanggal_terbit", "")),
                    plg_id=int(row_dict["plg_id"]) if pd.notna(row_dict.get("plg_id")) else None,
                    nama_pemohon=str(row_dict.get("nama_pemohon", "")),
                    nama_perangkat=str(row_dict.get("nama_perangkat", "")),
                    merk=str(row_dict.get("merk", "")),
                    model=str(row_dict.get("model", "")),
                    nama_pemasaran=str(row_dict.get("nama_pemasaran", "")),
                    negara=str(row_dict.get("negara", "")),
                )

                doc = build_djid_document(row_dict, variant="standard")
                entry = DjidEntry(
                    snapshot_id=snapshot.id,
                    nomor_sertifikat=valid_row.nomor_sertifikat,
                    tanggal_terbit=valid_row.tanggal_terbit,
                    plg_id=valid_row.plg_id,
                    nama_pemohon=valid_row.nama_pemohon,
                    nama_perangkat=valid_row.nama_perangkat,
                    merk=valid_row.merk,
                    model=valid_row.model,
                    nama_pemasaran=valid_row.nama_pemasaran,
                    negara=valid_row.negara,
                    merk_norm=clean_text(valid_row.merk),
                    model_norm=normalize_model(valid_row.model),
                    dokumen_indexing=doc,
                )
                entries.append(entry)
            except Exception as e:
                logger.warning("Gagal memproses baris DJID ke-%d: %s", idx + 1, e)

        db.bulk_save_objects(entries)
        seed_brand_aliases(db)
        db.commit()
        logger.info("Sukses meng-ingest %d entri DJID ke snapshot %s", len(entries), snapshot.id)
        return snapshot.id
    finally:
        db.close()


def ingest_marketplace(file_path: Path, source_platform: str = "tokopedia") -> str:
    """
    Ingest listing marketplace dengan validasi baris, karantina baris rusak, dan deduplikasi hash judul.
    """
    init_db()
    db = SessionLocal()
    try:
        df = pd.read_csv(file_path, encoding="utf-8-sig")
        logger.info("Membaca %d baris scraper dari %s", len(df), file_path)

        batch = ScrapeBatch(
            sumber=source_platform,
            waktu_scrape=datetime.utcnow(),
            jumlah_baris=len(df),
            file_asli=str(file_path.name),
        )
        db.add(batch)
        db.flush()

        djid_brands = {b[0] for b in db.query(DjidEntry.merk_norm).distinct().all()}
        detector = BrandDetector(brands_djid=djid_brands)

        valid_listings = []
        quarantined = []
        seen_hashes = set()

        for idx, row in df.iterrows():
            row_dict = {k: (v if pd.notna(v) else None) for k, v in row.to_dict().items()}
            try:
                item = ScrapedListingRow(**row_dict)
                clean_title = clean_text(item.data2)
                core_title = remove_noise(item.data2)
                title_hash = hashlib.sha256(clean_title.encode("utf-8")).hexdigest()

                price_num = item.parse_price()
                brand_res = detector.detect(item.data2)

                listing = Listing(
                    scrape_batch_id=batch.id,
                    judul_mentah=item.data2,
                    judul_bersih=clean_title,
                    judul_inti=core_title,
                    hash_judul=title_hash,
                    harga_mentah=item.data,
                    harga_angka=price_num,
                    url_start=item.web_scraper_start_url,
                    url_gambar=item.image,
                    brand_terdeteksi=brand_res.canonical_brand,
                )
                valid_listings.append(listing)
                seen_hashes.add(title_hash)
            except (ValidationError, Exception) as err:
                quarantine = QuarantineListing(
                    scrape_batch_id=batch.id,
                    baris_ke=idx + 1,
                    raw_payload=row_dict,
                    alasan_penolakan=str(err),
                )
                quarantined.append(quarantine)

        if valid_listings:
            db.bulk_save_objects(valid_listings)
        if quarantined:
            db.bulk_save_objects(quarantined)

        db.commit()
        logger.info(
            "Ingest batch %s selesai: %d valid (%d judul unik), %d dikarantina.",
            batch.id,
            len(valid_listings),
            len(seen_hashes),
            len(quarantined),
        )
        return batch.id
    finally:
        db.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="SITRUS Data Ingestion CLI")
    subparsers = parser.add_subparsers(dest="command", required=True)

    djid_parser = subparsers.add_parser("djid", help="Ingest DJID certification CSV")
    djid_parser.add_argument("--file", type=Path, required=True, help="Path ke file DJID.csv")
    djid_parser.add_argument("--date", type=str, default=None, help="Tanggal snapshot resmi (YYYY-MM-DD)")
    djid_parser.add_argument("--note", type=str, default="", help="Catatan snapshot")

    mkt_parser = subparsers.add_parser("marketplace", help="Ingest marketplace listings CSV")
    mkt_parser.add_argument("--file", type=Path, required=True, help="Path ke file listing_marketplace.csv")
    mkt_parser.add_argument("--source", type=str, default="tokopedia", help="Platform sumber (tokopedia/shopee)")

    args = parser.parse_args()

    if args.command == "djid":
        snap_d = datetime.strptime(args.date, "%Y-%m-%d").date() if args.date else None
        ingest_djid(args.file, snapshot_date=snap_d, note=args.note)
    elif args.command == "marketplace":
        ingest_marketplace(args.file, source_platform=args.source)


if __name__ == "__main__":
    main()
