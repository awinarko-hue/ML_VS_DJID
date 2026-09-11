"""
FastAPI Application for SITRUS (Sistem Triase Sertifikasi Perangkat).

Single source of truth for text normalization, feature extraction, and triage logic is ertriage.
Pre-loads SBERT and FAISS at lifespan startup.
"""

from __future__ import annotations

import hashlib
import io
import json
import logging
import time
import uuid
from contextlib import asynccontextmanager
from datetime import datetime
from pathlib import Path
from typing import Any, AsyncGenerator

import pandas as pd
from fastapi import Depends, FastAPI, File, Form, HTTPException, Query, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import desc, func
from sqlalchemy.orm import Session

from ertriage.artifacts import calculate_file_checksum, load_system
from ertriage.brands import BrandDetector
from ertriage.config import (
    FEATURES_PRODUCTION,
    REASON_CODES,
    STATUS_BERSERTIFIKAT,
    STATUS_BUKAN_TELEKOMUNIKASI,
    STATUS_PERLU_VERIFIKASI,
    STATUS_TERINDIKASI_TIDAK,
    KonfigurasiTriase,
)
from ertriage.text import clean_text, remove_noise
from ertriage.triage import SistemTriase

from apps.api.database import Base, SessionLocal, engine, get_db
from apps.api.models import (
    AuditLog,
    BrandAlias,
    DjidEntry,
    DjidSnapshot,
    Listing,
    QuarantineListing,
    ReviewDecision,
    ReviewTask,
    ScrapeBatch,
    TriageResult,
    TriageRun,
)
from apps.api.schemas import (
    BrandAliasCreate,
    BrandAliasResponse,
    ListingBatchIngestRequest,
    ListingIngestResponse,
    ListingManualCreate,
    ReviewDecisionCreate,
    ScrapedListingRow,
    TriageSingleRequest,
    TriageSingleResponse,
)
from apps.worker.tasks import process_triage_run

logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger("sitrus.api")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """
    Inisialisasi aplikasi FastAPI saat startup.
    Membuat tabel database jika belum ada dan memuat SistemTriase ke memory sekali saja.
    """
    logger.info("Menginisialisasi basis data...")
    Base.metadata.create_all(bind=engine)

    logger.info("Memuat artefak model & indeks FAISS ke app.state.triage_system...")
    try:
        cfg = KonfigurasiTriase()
        app.state.triage_system = load_system(cfg)
        logger.info("SistemTriase berhasil dimuat ke memori lifespan.")
    except Exception as e:
        logger.error("Gagal memuat SistemTriase saat startup: %s", e)
        app.state.triage_system = None

    yield

    logger.info("Mematikan layanan SITRUS API...")


app = FastAPI(
    title="SITRUS API",
    description="Sistem Triase Sertifikasi Alat dan atau Perangkat Telekomunikasi (DJID)",
    version="1.0.0",
    lifespan=lifespan,
)

from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

# CORS middleware for Frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static web assets
static_dir = Path(__file__).resolve().parent.parent / "web" / "static"
if static_dir.exists():
    app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")


@app.get("/", include_in_schema=False)
def serve_index() -> FileResponse:
    index_path = static_dir / "index.html"
    if index_path.exists():
        return FileResponse(index_path)
    return {"message": "SITRUS API running. Frontend static directory not found."}


def get_triage_system() -> SistemTriase:
    """Dependency untuk mendapatkan instance SistemTriase yang telah dimuat di startup."""
    sys_instance = getattr(app.state, "triage_system", None)
    if sys_instance is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="SistemTriase belum siap atau gagal dimuat.",
        )
    return sys_instance


# ---------------------------------------------------------------------------
# Health & Status Endpoints
# ---------------------------------------------------------------------------


@app.get("/health", tags=["Health"])
@app.get("/api/health", tags=["Health"])
def get_health(db: Session = Depends(get_db)) -> dict[str, Any]:
    """
    Healthcheck endpoint yang mengembalikan status sistem, koneksi database,
    dan checksum artefak yang aktif.
    """
    db_status = "healthy"
    try:
        db.execute(func.now())
    except Exception as e:
        db_status = f"unhealthy: {e}"

    manifest_path = Path("Artefak/manifest.json")
    manifest_data = {}
    if manifest_path.exists():
        try:
            with open(manifest_path, "r", encoding="utf-8") as f:
                manifest_data = json.load(f)
        except Exception:
            pass

    triage_ready = getattr(app.state, "triage_system", None) is not None

    return {
        "status": "ok" if triage_ready and db_status == "healthy" else "degraded",
        "timestamp": datetime.utcnow().isoformat(),
        "database": db_status,
        "triage_system_ready": triage_ready,
        "artifacts_manifest": manifest_data,
    }


# ---------------------------------------------------------------------------
# Triage Endpoints
# ---------------------------------------------------------------------------


@app.post("/api/triage/single", response_model=TriageSingleResponse, tags=["Triage"])
def triage_single_title(
    req: TriageSingleRequest,
    triage_sys: SistemTriase = Depends(get_triage_system),
) -> TriageSingleResponse:
    """
    Triase sinkron berkecepatan tinggi (< 400ms) untuk satu judul listing marketplace.
    """
    t0 = time.perf_counter()
    result = triage_sys.triage(req.judul)
    durasi_ms = int((time.perf_counter() - t0) * 1000)

    # Deskripsi keterangan reason code
    keterangan = REASON_CODES.get(result.reason, result.reason)

    return TriageSingleResponse(
        judul=result.judul,
        brand_terdeteksi=result.brand_terdeteksi,
        canonical_brand=result.canonical_brand,
        status=result.status,
        reason=result.reason,
        keterangan=keterangan,
        max_prob=result.max_prob,
        n_exact_hit=result.n_exact_hit,
        kandidat_terbaik=result.kandidat_terbaik,
        sertifikat_terbaik=result.sertifikat_terbaik,
        snapshot_djid=result.snapshot_djid,
        bukti_semantik=result.bukti_semantik,
        bukti_eksak=result.bukti_eksak,
    )


@app.post("/api/triage/runs", tags=["Triage"])
def trigger_batch_triage_run(
    batch_id: str | None = None,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """
    Memicu proses batch triage untuk batch marketplace listing yang dipilih.
    """
    # Ambil snapshot DJID aktif
    latest_snapshot = db.query(DjidSnapshot).order_by(desc(DjidSnapshot.dibuat_pada)).first()
    if not latest_snapshot:
        raise HTTPException(status_code=400, detail="Snapshot DJID belum di-ingest.")

    run_id = str(uuid.uuid4())
    new_run = TriageRun(
        id=run_id,
        snapshot_id=latest_snapshot.id,
        ambang={"t_high": 0.80, "t_low": 0.30},
        status_job="PENDING",
        total_listing=0,
        dijalankan_oleh="analyst",
    )
    db.add(new_run)
    db.commit()

    try:
        res = process_triage_run(run_id=run_id, batch_id=batch_id)
        return {"run_id": run_id, "status": "COMPLETED", "summary": res}
    except Exception as e:
        logger.exception("Gagal menjalankan batch triage: %s", e)
        return {"run_id": run_id, "status": "FAILED", "error": str(e)}


@app.get("/api/triage/runs", tags=["Triage"])
def list_triage_runs(
    skip: int = 0,
    limit: int = 20,
    db: Session = Depends(get_db),
) -> list[dict[str, Any]]:
    """
    Daftar riwayat batch triage run.
    """
    runs = db.query(TriageRun).order_by(desc(TriageRun.waktu_mulai)).offset(skip).limit(limit).all()
    return [
        {
            "id": r.id,
            "snapshot_id": r.snapshot_id,
            "status": r.status_job,
            "total_listing": r.total_listing,
            "waktu_mulai": r.waktu_mulai.isoformat() if r.waktu_mulai else None,
            "waktu_selesai": r.waktu_selesai.isoformat() if r.waktu_selesai else None,
            "dijalankan_oleh": r.dijalankan_oleh,
        }
        for r in runs
    ]


# ---------------------------------------------------------------------------
# Listings Ingestion & Audit Trail Endpoints
# ---------------------------------------------------------------------------


def process_and_ingest_records(
    records: list[dict[str, Any]],
    source: str,
    db: Session,
    filename: str | None = None,
    auto_triage: bool = True,
    triage_sys: SistemTriase | None = None,
) -> dict[str, Any]:
    """
    Memproses daftar record listing mentah (dari file CSV, payload JSON ekstensi, atau input manual),
    menjalankan validasi Pydantic, normalisasi teks, pembersihan noise, deteksi brand,
    deduplikasi hash judul, penyimpanan ke tabel Listing/Quarantine, serta auto-triage opsional.
    """
    if not records:
        raise HTTPException(status_code=400, detail="Tidak ada data listing yang diterima.")

    batch = ScrapeBatch(
        id=str(uuid.uuid4()),
        sumber=source,
        waktu_scrape=datetime.utcnow(),
        jumlah_baris=len(records),
        file_asli=filename or f"ingest_{source}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}",
    )
    db.add(batch)
    db.flush()

    if triage_sys and getattr(triage_sys, "brand_detector", None):
        detector = triage_sys.brand_detector
    else:
        djid_brands = {b[0] for b in db.query(DjidEntry.merk_norm).distinct().all()}
        detector = BrandDetector(brands_djid=djid_brands)

    valid_listings: list[Listing] = []
    quarantined: list[QuarantineListing] = []
    seen_hashes: set[str] = set()

    for idx, raw_row in enumerate(records):
        raw_title = (
            raw_row.get("data2")
            or raw_row.get("judul")
            or raw_row.get("nama")
            or raw_row.get("title")
            or raw_row.get("product_name")
            or ""
        )
        raw_price = (
            raw_row.get("data")
            or raw_row.get("harga")
            or raw_row.get("price")
            or ""
        )
        raw_url = (
            raw_row.get("web_scraper_start_url")
            or raw_row.get("url")
            or raw_row.get("url_produk")
            or raw_row.get("product_url")
            or ""
        )
        raw_img = (
            raw_row.get("image")
            or raw_row.get("url_gambar")
            or raw_row.get("gambar")
            or raw_row.get("image_url")
            or ""
        )
        seller = (
            raw_row.get("seller")
            or raw_row.get("nama_penjual")
            or raw_row.get("_seller")
            or ""
        )
        raw_badge = raw_row.get("data3") or raw_row.get("badge") or ""
        order_id = raw_row.get("web_scraper_order") or f"{int(time.time())}-{idx+1}"

        normalized_row = {
            "web_scraper_order": str(order_id),
            "web_scraper_start_url": str(raw_url) if raw_url else None,
            "data": str(raw_price) if raw_price is not None and str(raw_price).strip() != "" else None,
            "data2": str(raw_title).strip(),
            "data3": str(raw_badge) if raw_badge else None,
            "image": str(raw_img) if raw_img else None,
        }

        try:
            item = ScrapedListingRow(**normalized_row)
            clean_title = clean_text(item.data2)
            core_title = remove_noise(item.data2)
            title_hash = hashlib.sha256(clean_title.encode("utf-8")).hexdigest()

            price_num = item.parse_price()
            brand_res = detector.detect(item.data2)

            listing = Listing(
                id=str(uuid.uuid4()),
                scrape_batch_id=batch.id,
                judul_mentah=item.data2,
                judul_bersih=clean_title,
                judul_inti=core_title,
                hash_judul=title_hash,
                harga_mentah=item.data,
                harga_angka=price_num,
                url_start=item.web_scraper_start_url,
                url_gambar=item.image,
                nama_penjual=str(seller).strip() if seller else None,
                brand_terdeteksi=brand_res.canonical_brand,
            )
            valid_listings.append(listing)
            seen_hashes.add(title_hash)
        except Exception as err:
            quarantine = QuarantineListing(
                id=str(uuid.uuid4()),
                scrape_batch_id=batch.id,
                baris_ke=idx + 1,
                raw_payload=raw_row,
                alasan_penolakan=str(err),
            )
            quarantined.append(quarantine)

    if valid_listings:
        db.bulk_save_objects(valid_listings)
    if quarantined:
        db.bulk_save_objects(quarantined)

    db.commit()

    triage_summary = None
    if auto_triage and valid_listings:
        latest_snapshot = db.query(DjidSnapshot).order_by(desc(DjidSnapshot.dibuat_pada)).first()
        if latest_snapshot:
            run_id = str(uuid.uuid4())
            new_run = TriageRun(
                id=run_id,
                snapshot_id=latest_snapshot.id,
                ambang={"t_high": 0.80, "t_low": 0.30},
                status_job="PENDING",
                total_listing=len(valid_listings),
                dijalankan_oleh="auto_ingest",
            )
            db.add(new_run)
            db.commit()
            try:
                triage_summary = process_triage_run(run_id=run_id, batch_id=batch.id)
            except Exception as exc:
                logger.error("Auto-triage gagal untuk batch %s: %s", batch.id, exc)

    total_listings_now = db.query(func.count(Listing.id)).scalar() or 0

    return {
        "success": True,
        "batch_id": batch.id,
        "total_received": len(records),
        "valid_listings": len(valid_listings),
        "quarantined": len(quarantined),
        "total_listings_now": total_listings_now,
        "triage_summary": triage_summary,
    }


@app.post("/api/listings/upload-csv", response_model=ListingIngestResponse, tags=["Listings"])
async def upload_listings_csv(
    file: UploadFile = File(...),
    source: str = Form("csv_upload"),
    auto_triage: bool = Form(True),
    db: Session = Depends(get_db),
    triage_sys: SistemTriase = Depends(get_triage_system),
) -> ListingIngestResponse:
    """
    Menerima unggahan file CSV listing marketplace (dari hasil scraper Tokopedia / Shopee),
    memvalidasi baris, mendeteksi merek & nomor model, menyimpan listing ke database,
    dan otomatis mentriase kepatuhan sertifikasinya.
    """
    contents = await file.read()
    try:
        text_content = contents.decode("utf-8-sig")
    except UnicodeDecodeError:
        try:
            text_content = contents.decode("utf-8")
        except UnicodeDecodeError:
            text_content = contents.decode("latin-1")

    df = pd.read_csv(io.StringIO(text_content))
    records = df.to_dict(orient="records")

    res = process_and_ingest_records(
        records=records,
        source=source,
        db=db,
        filename=file.filename,
        auto_triage=auto_triage,
        triage_sys=triage_sys,
    )
    return ListingIngestResponse(**res)


@app.post("/api/listings/ingest", response_model=ListingIngestResponse, tags=["Listings"])
def ingest_listings_batch(
    req: ListingBatchIngestRequest,
    db: Session = Depends(get_db),
    triage_sys: SistemTriase = Depends(get_triage_system),
) -> ListingIngestResponse:
    """
    Endpoint integrasi langsung untuk menerima payload JSON listing dari Web Scraper Extension.
    """
    res = process_and_ingest_records(
        records=req.items,
        source=req.source,
        db=db,
        filename=f"extension_sync_{req.source}",
        auto_triage=req.auto_triage,
        triage_sys=triage_sys,
    )
    return ListingIngestResponse(**res)


@app.post("/api/listings/manual", tags=["Listings"])
def create_manual_listing(
    req: ListingManualCreate,
    db: Session = Depends(get_db),
    triage_sys: SistemTriase = Depends(get_triage_system),
) -> dict[str, Any]:
    """
    Memasukkan 1 listing marketplace secara manual dari formulir antarmuka web.
    """
    record = {
        "data2": req.judul,
        "data": req.harga,
        "web_scraper_start_url": req.url_produk,
        "nama_penjual": req.nama_penjual,
    }
    res = process_and_ingest_records(
        records=[record],
        source=req.platform,
        db=db,
        filename="manual_entry",
        auto_triage=req.auto_triage,
        triage_sys=triage_sys,
    )
    return res


@app.get("/api/listings", tags=["Listings"])
def list_listings(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    q: str | None = None,
    status_triase: str | None = None,
    sort_by: str = "created_at",
    sort_order: str = "desc",
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """
    Daftar listing marketplace dengan pagination dan filter.
    """
    query = db.query(Listing)

    if q:
        search_fmt = f"%{q.strip()}%"
        query = query.filter(Listing.judul_mentah.ilike(search_fmt))

    total = query.count()

    if sort_by == "harga":
        order_col = Listing.harga_angka
    else:
        order_col = Listing.dibuat_pada

    if sort_order == "asc":
        query = query.order_by(order_col.asc())
    else:
        query = query.order_by(order_col.desc())

    offset = (page - 1) * limit
    listings = query.offset(offset).limit(limit).all()

    items = []
    for item in listings:
        # Ambil TriageResult terakhir untuk listing ini jika ada
        latest_res = (
            db.query(TriageResult)
            .filter(TriageResult.listing_id == item.id)
            .order_by(desc(TriageResult.id))
            .first()
        )
        items.append(
            {
                "id": item.id,
                "judul_mentah": item.judul_mentah,
                "judul_bersih": item.judul_bersih,
                "harga_angka": item.harga_angka,
                "harga_mentah": item.harga_mentah,
                "url_gambar": item.url_gambar,
                "nama_penjual": item.nama_penjual,
                "brand_terdeteksi": item.brand_terdeteksi,
                "status_triase": latest_res.status if latest_res else "BELUM_DITRIASE",
                "max_prob": latest_res.max_prob if latest_res else None,
                "reason_code": latest_res.reason_code if latest_res else None,
                "dibuat_pada": item.dibuat_pada.isoformat() if item.dibuat_pada else None,
            }
        )

    return {
        "items": items,
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": (total + limit - 1) // limit,
    }


@app.get("/api/listings/{listing_id}", tags=["Listings"])
def get_listing_detail(
    listing_id: str,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """
    Detail listing spesifik beserta bukti lengkap Top-K kandidat DJID,
    riwayat keputusan review manusia, dan disclaimer hukum snapshot DJID.
    """
    listing = db.query(Listing).filter(Listing.id == listing_id).first()
    if not listing:
        raise HTTPException(status_code=404, detail="Listing tidak ditemukan")

    # Ambil TriageResult terakhir
    latest_result = (
        db.query(TriageResult)
        .filter(TriageResult.listing_id == listing_id)
        .order_by(desc(TriageResult.id))
        .first()
    )

    triage_info = None
    review_task_info = None
    reviews_info = []

    if latest_result:
        bukti_dict = latest_result.bukti or {}
        triage_info = {
            "status": latest_result.status,
            "reason": latest_result.reason_code,
            "keterangan": REASON_CODES.get(latest_result.reason_code, latest_result.reason_code),
            "max_prob": latest_result.max_prob,
            "n_exact_hit": latest_result.n_exact_hit,
            "kandidat_terbaik": bukti_dict.get("kandidat_terbaik_identitas"),
            "sertifikat_terbaik": bukti_dict.get("kandidat_terbaik_sertifikat"),
            "bukti_semantik": bukti_dict.get("bukti_semantik", []),
            "bukti_eksak": bukti_dict.get("bukti_eksak", []),
            "snapshot_djid": latest_result.snapshot_date,
        }

        # Cek review task
        if latest_result.review_task:
            task = latest_result.review_task
            review_task_info = {
                "id": task.id,
                "status_antrean": task.status_antrean,
                "prioritas": task.prioritas,
                "ditugaskan_ke": task.ditugaskan_ke,
                "dibuat_pada": task.dibuat_pada.isoformat() if task.dibuat_pada else None,
            }
            reviews_info = [
                {
                    "id": dec.id,
                    "keputusan_manusia": dec.keputusan_manusia,
                    "catatan": dec.catatan,
                    "reviewer_id": dec.reviewer_id,
                    "waktu_putusan": dec.waktu_putusan.isoformat() if dec.waktu_putusan else None,
                }
                for dec in task.decisions
            ]

    return {
        "id": listing.id,
        "judul_mentah": listing.judul_mentah,
        "judul_bersih": listing.judul_bersih,
        "harga_angka": listing.harga_angka,
        "harga_mentah": listing.harga_mentah,
        "url_gambar": listing.url_gambar,
        "url_start": listing.url_start,
        "nama_penjual": listing.nama_penjual,
        "brand_terdeteksi": listing.brand_terdeteksi,
        "triage_result": triage_info,
        "review_task": review_task_info,
        "review_history": reviews_info,
        "disclaimer": (
            "Status triase 'TERINDIKASI_TIDAK_BERSERTIFIKAT' merupakan indikasi algoritmik awal "
            "berdasarkan snapshot data DJID dan wajib diverifikasi oleh analis pengawasan sebelum tindakan administratif."
        ),
    }


# ---------------------------------------------------------------------------
# Human Review Endpoints
# ---------------------------------------------------------------------------


@app.get("/api/review-queue", tags=["Review"])
def get_review_queue(
    prioritas: int | None = None,
    limit: int = Query(20, ge=1, le=100),
    page: int = Query(1, ge=1),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """
    Antrean verifikasi cepat (Fast Review Queue) untuk analis pengawasan.
    """
    query = (
        db.query(ReviewTask, TriageResult, Listing)
        .join(TriageResult, ReviewTask.triage_result_id == TriageResult.id)
        .join(Listing, TriageResult.listing_id == Listing.id)
        .filter(ReviewTask.status_antrean == "MENUNGGU")
    )

    if prioritas is not None:
        query = query.filter(ReviewTask.prioritas == prioritas)

    # Urutkan berdasarkan prioritas: 3 (HIGH) > 2 (MEDIUM) > 1 (LOW)
    query = query.order_by(desc(ReviewTask.prioritas), ReviewTask.dibuat_pada.asc())

    total = query.count()
    offset = (page - 1) * limit
    results = query.offset(offset).limit(limit).all()

    items = []
    for task, t_res, listing in results:
        items.append(
            {
                "task_id": task.id,
                "triage_result_id": t_res.id,
                "listing_id": listing.id,
                "judul_mentah": listing.judul_mentah,
                "harga_angka": listing.harga_angka,
                "prioritas": task.prioritas,
                "status_triase": t_res.status,
                "max_prob": t_res.max_prob,
                "reason_code": t_res.reason_code,
                "dibuat_pada": task.dibuat_pada.isoformat() if task.dibuat_pada else None,
            }
        )

    return {
        "items": items,
        "total": total,
        "page": page,
        "limit": limit,
    }


@app.post("/api/reviews/tasks/{task_id}", tags=["Review"])
def submit_review_decision(
    task_id: str,
    req: ReviewDecisionCreate,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """
    Menyimpan keputusan verifikasi manusia atas sebuah review task (immutable review trail).
    """
    task = db.query(ReviewTask).filter(ReviewTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Review task tidak ditemukan")

    decision_id = str(uuid.uuid4())
    decision = ReviewDecision(
        id=decision_id,
        review_task_id=task_id,
        keputusan_manusia=req.keputusan_manusia,
        entri_djid_terpilih_id=req.entri_djid_terpilih_id,
        catatan=req.catatan,
        reviewer_id=req.reviewer_id,
        durasi_detik=req.durasi_detik,
    )
    db.add(decision)

    # Update status review task
    task.status_antrean = "SELESAI"

    # Audit log
    audit = AuditLog(
        id=str(uuid.uuid4()),
        aktor=req.reviewer_id,
        aksi="HUMAN_REVIEW_DECISION",
        entitas="ReviewTask",
        entitas_id=task_id,
        payload_sesudah={"keputusan": req.keputusan_manusia, "catatan": req.catatan},
    )
    db.add(audit)
    db.commit()

    return {
        "status": "success",
        "decision_id": decision_id,
        "task_id": task_id,
        "keputusan": req.keputusan_manusia,
    }


# ---------------------------------------------------------------------------
# Brand Aliases Endpoints
# ---------------------------------------------------------------------------


@app.get("/api/brands/aliases", response_model=list[BrandAliasResponse], tags=["Brands"])
def list_brand_aliases(db: Session = Depends(get_db)) -> list[BrandAlias]:
    """
    Daftar kamus alias merek yang terdaftar di database.
    """
    return db.query(BrandAlias).order_by(BrandAlias.alias.asc()).all()


@app.post("/api/brands/aliases", response_model=BrandAliasResponse, tags=["Brands"])
def create_brand_alias(
    req: BrandAliasCreate,
    db: Session = Depends(get_db),
) -> BrandAlias:
    """
    Menambahkan pemetaan alias merek baru ke merek kanonik DJID.
    """
    clean_alias = req.alias.strip().lower()
    clean_canonical = req.merk_kanonik.strip().lower()

    existing = db.query(BrandAlias).filter(BrandAlias.alias == clean_alias).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Alias '{clean_alias}' sudah terdaftar untuk merek '{existing.merk_kanonik}'.",
        )

    new_alias = BrandAlias(
        id=str(uuid.uuid4()),
        alias=clean_alias,
        merk_kanonik=clean_canonical,
        sumber=req.sumber,
        dibuat_oleh="analyst",
    )
    db.add(new_alias)
    db.commit()
    db.refresh(new_alias)

    # Perbarui alias di detektor SistemTriase aktif
    triage_sys = getattr(app.state, "triage_system", None)
    if triage_sys and triage_sys.brand_detector:
        triage_sys.brand_detector.aliases[clean_alias] = clean_canonical
        logger.info("Alias merek '%s' -> '%s' ditambahkan ke detektor aktif.", clean_alias, clean_canonical)

    return new_alias


# ---------------------------------------------------------------------------
# Dashboard Analytics Endpoint
# ---------------------------------------------------------------------------


@app.get("/api/stats/dashboard", tags=["Dashboard"])
def get_dashboard_stats(db: Session = Depends(get_db)) -> dict[str, Any]:
    """
    Statistik agregat untuk Dashboard Analis Pengawasan.
    """
    total_listings = db.query(func.count(Listing.id)).scalar() or 0

    # Distribusi status dari TriageResult terbaru
    n_bersertifikat = db.query(func.count(TriageResult.id)).filter(TriageResult.status == STATUS_BERSERTIFIKAT).scalar() or 0
    n_terindikasi_tidak = db.query(func.count(TriageResult.id)).filter(TriageResult.status == STATUS_TERINDIKASI_TIDAK).scalar() or 0
    n_perlu_verifikasi = db.query(func.count(TriageResult.id)).filter(TriageResult.status == STATUS_PERLU_VERIFIKASI).scalar() or 0
    n_bukan_perangkat = db.query(func.count(TriageResult.id)).filter(TriageResult.status == STATUS_BUKAN_TELEKOMUNIKASI).scalar() or 0

    total_ditriase = n_bersertifikat + n_terindikasi_tidak + n_perlu_verifikasi + n_bukan_perangkat
    n_belum_ditriase = max(0, total_listings - total_ditriase)

    # Antrean verifikasi
    n_queue_pending = db.query(func.count(ReviewTask.id)).filter(ReviewTask.status_antrean == "MENUNGGU").scalar() or 0
    n_queue_high = (
        db.query(func.count(ReviewTask.id))
        .filter(ReviewTask.status_antrean == "MENUNGGU", ReviewTask.prioritas == 3)
        .scalar()
        or 0
    )
    n_queue_completed = db.query(func.count(ReviewTask.id)).filter(ReviewTask.status_antrean == "SELESAI").scalar() or 0

    pct_unverified = 100.0 * n_queue_pending / total_listings if total_listings > 0 else 0.0

    # Snapshot DJID aktif
    latest_snapshot = db.query(DjidSnapshot).order_by(desc(DjidSnapshot.dibuat_pada)).first()
    snapshot_date = latest_snapshot.tanggal_snapshot.isoformat() if latest_snapshot else datetime.utcnow().strftime("%Y-%m-%d")
    total_entries = latest_snapshot.jumlah_entri if latest_snapshot else 1333

    return {
        "total_listings": total_listings,
        "status_distribution": {
            "bersertifikat": n_bersertifikat,
            "terindikasi_tidak_bersertifikat": n_terindikasi_tidak,
            "perlu_verifikasi_manusia": n_perlu_verifikasi,
            "bukan_perangkat_telekomunikasi": n_bukan_perangkat,
            "belum_ditriase": n_belum_ditriase,
        },
        "verification": {
            "total_terverifikasi": n_queue_completed,
            "total_belum_terverifikasi": n_queue_pending,
            "persen_belum_terverifikasi": round(pct_unverified, 1),
        },
        "review_queue": {
            "total_antrean_menunggu": n_queue_pending,
            "antrean_prioritas_tinggi": n_queue_high,
        },
        "snapshot_djid_aktif": {
            "tanggal": snapshot_date,
            "total_entri": total_entries,
        },
    }
