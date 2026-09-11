"""
SQLAlchemy 2.x ORM models for SITRUS domain database schema.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Any

from sqlalchemy import (
    BigInteger,
    Boolean,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from apps.api.database import Base


def generate_uuid() -> str:
    return str(uuid.uuid4())


class DjidSnapshot(Base):
    __tablename__ = "djid_snapshot"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    tanggal_snapshot: Mapped[date] = mapped_column(Date, nullable=False)
    checksum: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    jumlah_entri: Mapped[int] = mapped_column(Integer, nullable=False)
    catatan: Mapped[str | None] = mapped_column(Text, nullable=True)
    dibuat_oleh: Mapped[str] = mapped_column(String(100), default="system")
    dibuat_pada: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    entries: Mapped[list[DjidEntry]] = relationship("DjidEntry", back_populates="snapshot", cascade="all, delete-orphan")


class DjidEntry(Base):
    __tablename__ = "djid_entry"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    snapshot_id: Mapped[str] = mapped_column(String(36), ForeignKey("djid_snapshot.id"), nullable=False, index=True)
    nomor_sertifikat: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    tanggal_terbit: Mapped[str | None] = mapped_column(String(50), nullable=True)
    plg_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    nama_pemohon: Mapped[str | None] = mapped_column(String(255), nullable=True)
    nama_perangkat: Mapped[str | None] = mapped_column(String(255), nullable=True)
    merk: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    model: Mapped[str] = mapped_column(String(150), nullable=False, index=True)
    nama_pemasaran: Mapped[str | None] = mapped_column(String(255), nullable=True)
    negara: Mapped[str | None] = mapped_column(String(100), nullable=True)
    merk_norm: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    model_norm: Mapped[str] = mapped_column(String(150), nullable=False, index=True)
    dokumen_indexing: Mapped[str] = mapped_column(Text, nullable=False)

    snapshot: Mapped[DjidSnapshot] = relationship("DjidSnapshot", back_populates="entries")


class BrandAlias(Base):
    __tablename__ = "brand_alias"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    alias: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    merk_kanonik: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    sumber: Mapped[str] = mapped_column(String(50), default="analyst_rule")
    dibuat_oleh: Mapped[str] = mapped_column(String(100), default="system")
    dibuat_pada: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class ScrapeBatch(Base):
    __tablename__ = "scrape_batch"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    sumber: Mapped[str] = mapped_column(String(50), nullable=False)
    waktu_scrape: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    start_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    jumlah_baris: Mapped[int] = mapped_column(Integer, default=0)
    file_asli: Mapped[str | None] = mapped_column(String(255), nullable=True)
    dibuat_pada: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    listings: Mapped[list[Listing]] = relationship("Listing", back_populates="batch", cascade="all, delete-orphan")
    quarantined: Mapped[list[QuarantineListing]] = relationship("QuarantineListing", back_populates="batch", cascade="all, delete-orphan")


class Listing(Base):
    __tablename__ = "listing"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    scrape_batch_id: Mapped[str] = mapped_column(String(36), ForeignKey("scrape_batch.id"), nullable=False, index=True)
    judul_mentah: Mapped[str] = mapped_column(Text, nullable=False)
    judul_bersih: Mapped[str] = mapped_column(Text, nullable=False)
    judul_inti: Mapped[str] = mapped_column(Text, nullable=False)
    hash_judul: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    harga_mentah: Mapped[str | None] = mapped_column(String(100), nullable=True)
    harga_angka: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    url_start: Mapped[str | None] = mapped_column(Text, nullable=True)
    url_gambar: Mapped[str | None] = mapped_column(Text, nullable=True)
    nama_penjual: Mapped[str | None] = mapped_column(String(150), nullable=True)
    brand_terdeteksi: Mapped[str | None] = mapped_column(String(100), nullable=True)
    dibuat_pada: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    batch: Mapped[ScrapeBatch] = relationship("ScrapeBatch", back_populates="listings")


class QuarantineListing(Base):
    __tablename__ = "quarantine_listing"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    scrape_batch_id: Mapped[str] = mapped_column(String(36), ForeignKey("scrape_batch.id"), nullable=False, index=True)
    baris_ke: Mapped[int] = mapped_column(Integer, nullable=False)
    raw_payload: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    alasan_penolakan: Mapped[str] = mapped_column(String(255), nullable=False)
    dibuat_pada: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    batch: Mapped[ScrapeBatch] = relationship("ScrapeBatch", back_populates="quarantined")


class ArtifactVersion(Base):
    __tablename__ = "artifact_version"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    jenis: Mapped[str] = mapped_column(String(50), nullable=False)
    versi: Mapped[str] = mapped_column(String(50), nullable=False)
    checksum: Mapped[str] = mapped_column(String(64), nullable=False)
    snapshot_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("djid_snapshot.id"), nullable=True)
    hyperparameter: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    metrik: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    dibuat_pada: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class TriageRun(Base):
    __tablename__ = "triage_run"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    artifact_version_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("artifact_version.id"), nullable=True)
    snapshot_id: Mapped[str] = mapped_column(String(36), ForeignKey("djid_snapshot.id"), nullable=False)
    ambang: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    status_job: Mapped[str] = mapped_column(String(50), default="PENDING")
    total_listing: Mapped[int] = mapped_column(Integer, default=0)
    waktu_mulai: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    waktu_selesai: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    dijalankan_oleh: Mapped[str] = mapped_column(String(100), default="system")

    results: Mapped[list[TriageResult]] = relationship("TriageResult", back_populates="run", cascade="all, delete-orphan")


class TriageResult(Base):
    __tablename__ = "triage_result"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    run_id: Mapped[str] = mapped_column(String(36), ForeignKey("triage_run.id"), nullable=False, index=True)
    listing_id: Mapped[str] = mapped_column(String(36), ForeignKey("listing.id"), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    reason_code: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    keterangan: Mapped[str] = mapped_column(Text, nullable=False)
    max_prob: Mapped[float] = mapped_column(Float, default=0.0)
    n_exact_hit: Mapped[int] = mapped_column(Integer, default=0)
    kandidat_terbaik_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("djid_entry.id"), nullable=True)
    bukti: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    snapshot_date: Mapped[str] = mapped_column(String(50), nullable=False)

    run: Mapped[TriageRun] = relationship("TriageRun", back_populates="results")
    listing: Mapped[Listing] = relationship("Listing")
    review_task: Mapped[ReviewTask | None] = relationship("ReviewTask", back_populates="triage_result", uselist=False)


class ReviewTask(Base):
    __tablename__ = "review_task"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    triage_result_id: Mapped[str] = mapped_column(String(36), ForeignKey("triage_result.id"), unique=True, nullable=False)
    status_antrean: Mapped[str] = mapped_column(String(50), default="MENUNGGU", index=True)
    prioritas: Mapped[int] = mapped_column(Integer, default=1)
    ditugaskan_ke: Mapped[str | None] = mapped_column(String(100), nullable=True)
    dibuat_pada: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    triage_result: Mapped[TriageResult] = relationship("TriageResult", back_populates="review_task")
    decisions: Mapped[list[ReviewDecision]] = relationship("ReviewDecision", back_populates="task", cascade="all, delete-orphan")


class ReviewDecision(Base):
    __tablename__ = "review_decision"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    review_task_id: Mapped[str] = mapped_column(String(36), ForeignKey("review_task.id"), nullable=False, index=True)
    keputusan_manusia: Mapped[str] = mapped_column(String(50), nullable=False)
    entri_djid_terpilih_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("djid_entry.id"), nullable=True)
    catatan: Mapped[str | None] = mapped_column(Text, nullable=True)
    reviewer_id: Mapped[str] = mapped_column(String(100), nullable=False)
    durasi_detik: Mapped[int | None] = mapped_column(Integer, nullable=True)
    waktu_putusan: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    task: Mapped[ReviewTask] = relationship("ReviewTask", back_populates="decisions")


class AuditLog(Base):
    __tablename__ = "audit_log"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    aktor: Mapped[str] = mapped_column(String(100), nullable=False)
    aksi: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    entitas: Mapped[str] = mapped_column(String(100), nullable=False)
    entitas_id: Mapped[str] = mapped_column(String(100), nullable=False)
    payload_sebelum: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    payload_sesudah: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    waktu: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    ip_address: Mapped[str | None] = mapped_column(String(50), nullable=True)


class User(Base):
    __tablename__ = "user_account"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    username: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(100), nullable=False)
    role: Mapped[str] = mapped_column(String(50), default="ANALIS")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    dibuat_pada: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
