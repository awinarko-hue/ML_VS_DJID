"""
Asynchronous Triage Worker Tasks.

Processes bulk marketplace listings using packages/ertriage without duplicating logic.
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime
from typing import Any

from ertriage.artifacts import load_system
from ertriage.config import (
    STATUS_BERSERTIFIKAT,
    STATUS_BUKAN_TELEKOMUNIKASI,
    STATUS_PERLU_VERIFIKASI,
    STATUS_TERINDIKASI_TIDAK,
    KonfigurasiTriase,
)
from ertriage.triage import SistemTriase

from apps.api.database import SessionLocal
from apps.api.models import (
    AuditLog,
    DjidEntry,
    DjidSnapshot,
    Listing,
    ReviewTask,
    TriageResult,
    TriageRun,
)

logger = logging.getLogger("sitrus.worker")

# Cache instance SistemTriase di tingkat worker process
_CACHED_TRIAGE_SYSTEM: SistemTriase | None = None


def get_worker_triage_system() -> SistemTriase:
    global _CACHED_TRIAGE_SYSTEM
    if _CACHED_TRIAGE_SYSTEM is None:
        logger.info("Memuat SistemTriase ke memori worker...")
        _CACHED_TRIAGE_SYSTEM = load_system(KonfigurasiTriase())
    return _CACHED_TRIAGE_SYSTEM


def process_triage_run(
    run_id: str,
    batch_id: str | None = None,
    listing_ids: list[str] | None = None,
) -> dict[str, Any]:
    """
    Eksekusi batch triage asinkron atas run_id tertentu.
    """
    db = SessionLocal()
    try:
        run = db.query(TriageRun).filter(TriageRun.id == run_id).first()
        if not run:
            logger.error("TriageRun %s tidak ditemukan di database.", run_id)
            return {"status": "error", "message": f"Run {run_id} not found"}

        run.status_job = "RUNNING"
        run.waktu_mulai = datetime.utcnow()
        db.commit()

        # Query listing target
        query = db.query(Listing)
        if batch_id:
            query = query.filter(Listing.scrape_batch_id == batch_id)
        elif listing_ids:
            query = query.filter(Listing.id.in_(listing_ids))

        listings = query.all()
        total_listings = len(listings)
        run.total_listing = total_listings
        db.commit()

        if total_listings == 0:
            run.status_job = "COMPLETED"
            run.waktu_selesai = datetime.utcnow()
            db.commit()
            return {"status": "completed", "n_total": 0}

        triage_sys = get_worker_triage_system()

        n_bersertifikat = 0
        n_terindikasi_tidak = 0
        n_perlu_verifikasi = 0
        n_bukan_perangkat = 0

        for idx, listing in enumerate(listings):
            # Eksekusi triase via core engine tunggal
            res = triage_sys.triage(listing.judul_bersih)

            # Cari entry ID djid jika ada nomor sertifikat / identitas terbaik
            kandidat_djid_id = None
            if res.sertifikat_terbaik:
                d_entry = db.query(DjidEntry).filter(DjidEntry.nomor_sertifikat == res.sertifikat_terbaik).first()
                if d_entry:
                    kandidat_djid_id = d_entry.id

            bukti_payload = {
                "bukti_semantik": res.bukti_semantik,
                "bukti_eksak": res.bukti_eksak,
                "kandidat_terbaik_identitas": res.kandidat_terbaik,
                "kandidat_terbaik_sertifikat": res.sertifikat_terbaik,
                "canonical_brand": res.canonical_brand,
            }

            # Buat record TriageResult
            t_res_id = str(uuid.uuid4())
            t_res = TriageResult(
                id=t_res_id,
                run_id=run.id,
                listing_id=listing.id,
                status=res.status,
                reason_code=res.reason,
                keterangan=res.reason,
                max_prob=float(res.max_prob),
                n_exact_hit=int(res.n_exact_hit),
                kandidat_terbaik_id=kandidat_djid_id,
                bukti=bukti_payload,
                snapshot_date=res.snapshot_djid,
            )
            db.add(t_res)

            # Update brand terdeteksi di listing
            listing.brand_terdeteksi = res.canonical_brand or res.brand_terdeteksi

            # Hitung counter & tentukan prioritas antrean review
            if res.status == STATUS_TERINDIKASI_TIDAK:
                n_terindikasi_tidak += 1
                prioritas_val = 3  # HIGH
            elif res.status == STATUS_PERLU_VERIFIKASI:
                n_perlu_verifikasi += 1
                prioritas_val = 2  # MEDIUM
            elif res.status == STATUS_BUKAN_TELEKOMUNIKASI:
                n_bukan_perangkat += 1
                prioritas_val = 1  # LOW
            else:
                n_bersertifikat += 1
                prioritas_val = 1  # LOW

            # Buat ReviewTask untuk setiap triage result
            review_task = ReviewTask(
                id=str(uuid.uuid4()),
                triage_result_id=t_res_id,
                status_antrean="MENUNGGU",
                prioritas=prioritas_val,
            )
            db.add(review_task)

            # Commit bertahap tiap 100 item
            if (idx + 1) % 100 == 0:
                db.commit()

        # Final commit & complete
        run.status_job = "COMPLETED"
        run.waktu_selesai = datetime.utcnow()

        # Audit log
        audit = AuditLog(
            id=str(uuid.uuid4()),
            aktor="worker",
            aksi="BATCH_TRIAGE_COMPLETED",
            entitas="TriageRun",
            entitas_id=run.id,
            payload_sesudah={
                "total_listing": total_listings,
                "n_bersertifikat": n_bersertifikat,
                "n_terindikasi_tidak": n_terindikasi_tidak,
                "n_perlu_verifikasi": n_perlu_verifikasi,
                "n_bukan_perangkat": n_bukan_perangkat,
            },
        )
        db.add(audit)
        db.commit()

        logger.info(
            "TriageRun %s selesai: Total=%d | Bersertifikat=%d | Terindikasi Tidak=%d | Perlu Verifikasi=%d",
            run_id,
            total_listings,
            n_bersertifikat,
            n_terindikasi_tidak,
            n_perlu_verifikasi,
        )
        return {
            "status": "completed",
            "n_total": total_listings,
            "n_bersertifikat": n_bersertifikat,
            "n_terindikasi_tidak": n_terindikasi_tidak,
            "n_perlu_verifikasi": n_perlu_verifikasi,
        }

    except Exception as e:
        logger.exception("Gagal memproses TriageRun %s: %s", run_id, e)
        db.rollback()
        run = db.query(TriageRun).filter(TriageRun.id == run_id).first()
        if run:
            run.status_job = "FAILED"
            run.waktu_selesai = datetime.utcnow()
            db.commit()
        raise
    finally:
        db.close()
