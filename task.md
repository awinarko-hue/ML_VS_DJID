# TASK LIST — SITRUS (Sistem Triase Sertifikasi Perangkat)

Dokumen pelacak pekerjaan atomik sesuai metodologi *Review-Driven Development*.

---

## FASE 0 — AUDIT BASELINE & DATA CONTRACT (GATE MANUSIA)
- [x] **Task 0.1**: Audit teknis kode riset eksisting & pemetaan cacat metodologis (`docs/AUDIT_BASELINE.md`)
- [x] **Task 0.2**: Definisi kontrak data, skema domain, dan analisis keandalan data (`docs/DATA_CONTRACT.md`)
- [x] **Task 0.3**: Pembuatan rencana implementasi komprehensif (`implementation_plan.md` & `task.md`)
- [x] **Task 0.4**: Persetujuan Pengguna (User Approval Gate) sebelum masuk Fase 1

---

## FASE 1 — PAKET INTI `packages/ertriage` & UJI PARITAS
- [x] **Task 1.1**: Inisialisasi struktur package `packages/ertriage/` (`__init__.py`, `config.py`)
- [x] **Task 1.2**: Implementasi utilitas pembersihan teks & normalisasi model (`text.py`)
- [x] **Task 1.3**: Implementasi ekstraksi fitur terpadu (`features.py`) untuk 7 fitur (`FEATURES_PRODUCTION`) dan 5 fitur (`FEATURES_EVALUABLE`)
- [x] **Task 1.4**: Implementasi deteksi merek dengan leksikon ganda & Aho-Corasick / regex alternation (`brands.py`)
- [x] **Task 1.5**: Implementasi dual-path retrieval (dense FAISS + sparse BM25 / char n-gram TF-IDF + Aho-Corasick exact scan) (`retrieval.py`)
- [x] **Task 1.6**: Implementasi lapisan keputusan triase dengan reason code lengkap & penanganan alias (`triage.py`)
- [x] **Task 1.7**: Implementasi registry artefak terkelola dengan checksum SHA-256 (`artifacts.py`)
- [x] **Task 1.8**: Pembuatan Golden Test Paritas Fitur (`tests/golden/test_feature_parity.py`) membandingkan output terhadap `Artefak/dataset_fitur_final.csv`
- [x] **Task 1.9**: Unit test komprehensif untuk seluruh reason code dan ambang konfigurasi (`tests/test_triage.py`, total 24 test, coverage 92%)

---

## FASE 2 — INGESTION & BASIS DATA DOMAIN
- [x] **Task 2.1**: Setup database SQLAlchemy 2.x ORM models & skema basis data domain (`apps/api/database.py`, `apps/api/models.py`)
- [x] **Task 2.2**: Implementasi Pydantic validation & skema karantina untuk data scraper tidak tepercaya (`apps/api/schemas.py`)
- [x] **Task 2.3**: Implementasi pipeline ingestion CLI `pipelines/ingest.py` untuk `DJID.csv` (snapshot + deduplikasi model) dan `listing_marketplace.csv` (deduplikasi `hash_judul`)
- [x] **Task 2.4**: Seed script untuk tabel `brand_alias` awal (misal: "POFUNG" $\to$ "BAOFENG", "MAG ONE" $\to$ "MOTOROLA")
- [x] **Task 2.5**: Test ingestion, validasi karantina baris rusak, dan deduplikasi (`tests/test_ingest.py`)

---

## FASE 3 — REBUILD ARTEFAK & PERBAIKAN RETRIEVAL
- [ ] **Task 3.1**: Implementasi pipeline rebuild terpadu `pipelines/build.py` (dense FAISS + sparse BM25 index + deduplikasi dokumen DJID)
- [ ] **Task 3.2**: Implementasi pelatihan classifier dengan 3-zone label (`1`/`0`/`-1`) dan `StratifiedGroupKFold` berdasarkan `idx_listing`
- [ ] **Task 3.3**: Pelatihan dua model terpisah: `FEATURES_PRODUCTION` (7 fitur) dan `FEATURES_EVALUABLE` (5 fitur) + model baseline (Dummy, Cosine TF-IDF, BM25, Fuzzy)
- [ ] **Task 3.4**: Evaluasi Recall@K (@5, @10, @20, @50) pada seluruh 1.019 listing dan pembuatan laporan `docs/EVAL_RETRIEVAL.md`
- [ ] **Task 3.5**: Test determinisme rebuild: menjalankan pipeline dua kali menghasilkan checksum artefak identik

---

## FASE 4 — LAYANAN TRIASE (API & WORKER)
- [ ] **Task 4.1**: Setup aplikasi FastAPI (`apps/api`) dengan model loading pada lifespan startup & healthcheck artefak
- [ ] **Task 4.2**: Implementasi endpoint sinkron triase satu listing `POST /api/triage/single` (target latency p95 < 400ms)
- [ ] **Task 4.3**: Setup background worker Redis + RQ (`apps/worker`) untuk batch triage
- [ ] **Task 4.4**: Implementasi endpoint asinkron batch triase `POST /api/triage/runs`, status polling, dan streaming progres
- [ ] **Task 4.5**: Integrasi pencatatan audit log terstruktur untuk setiap operasi triase

---

## FASE 5 — UI ANALIS PENGAWASAN
- [ ] **Task 5.1**: Setup frontend React 18 + Vite + TypeScript + Tailwind CSS
- [ ] **Task 5.2**: Implementasi Halaman Dashboard Run (distribusi status dengan indikasi verifikasi manusia, ringkasan batch, statistik model)
- [ ] **Task 5.3**: Implementasi Halaman Daftar Listing (tabel terfilter berdasarkan status, merek, reason code, batch; fitur ekspor dengan header disclaimer)
- [ ] **Task 5.4**: Implementasi Halaman Detail Listing (tampilan bukti semantik Top-K lengkap, bukti eksak, metadata snapshot DJID)
- [ ] **Task 5.5**: Implementasi Halaman Antrean Review Cepat (antarmuka kerja berurutan dengan keyboard shortcut untuk memilih entri DJID atau menandai unlisted)
- [ ] **Task 5.6**: Implementasi Halaman Admin (kelola alias merek, manajemen snapshot DJID, pemicu rebuild artefak, konfigurasi ambang)
- [ ] **Task 5.7**: Verifikasi UI menggunakan browser subagent dan dokumentasi screenshot di `walkthrough.md`

---

## FASE 6 — KALIBRASI AMBANG & EVALUASI GOLD SET
- [ ] **Task 6.1**: Implementasi CLI kalibrasi `pipelines/calibrate.py` menghitung kurva Precision-Recall out-of-fold dan rekomendasi `t_low`/`t_high`
- [ ] **Task 6.2**: Halaman UI Kalibrasi Ambang Interaktif (simulasi dampak ambang terhadap antrean review, penyimpanan versi kalibrasi baru tanpa menimpa data historis)
- [ ] **Task 6.3**: Modul ekspor Gold Set hasil verifikasi analis (CSV + JSON) dengan dukungan metrik reliabilitas antar-penilai (Cohen's Kappa)
- [ ] **Task 6.4**: Evaluasi listing-level terhadap gold set untuk perbandingan performa terukur

---

## FASE 7 — KEAMANAN, DOCKER COMPOSE, & FINALISASI
- [ ] **Task 7.1**: Autentikasi sesi berbasis Argon2 password hashing dengan 3 peran pengguna (`ADMIN`, `ANALIS`, `PENINJAU`)
- [ ] **Task 7.2**: Penegakan aturan produk (disclaimer wajib, pencegahan render status negatif tanpa tanggal snapshot, pencegahan aksi otomatis)
- [ ] **Task 7.3**: Konfigurasi `docker-compose.yml` (PostgreSQL, Redis, API, Worker, Web) yang dapat dijalankan langsung dengan satu perintah
- [ ] **Task 7.4**: Pembuatan dokumentasi `README.md` operasional lengkap
- [ ] **Task 7.5**: Verifikasi menyeluruh terhadap seluruh Kriteria Selesai
