# SITRUS — Sistem Triase Sertifikasi Perangkat

**SITRUS (Sistem Triase Sertifikasi Perangkat)** adalah platform web internal untuk membantu analis pengawasan spektrum frekuensi dan standardisasi perangkat (DJID / Balmon, Kementerian Komunikasi dan Informatika) dalam menyaring listing marketplace terhadap basis data sertifikasi perangkat telekomunikasi DJID secara otomatis, akurat, dan dapat dipertanggungjawabkan secara hukum.

---

## ⚖️ Prinsip Asimetri Hukum

Keluaran sistem ini memiliki **konsekuensi hukum** langsung bagi pemilik toko/listing:
- **Kesalahan Tipe I (False Accusation):** Menuduh produk yang sebenarnya bersertifikat sebagai "tidak bersertifikat". Kesalahan ini sangat mahal dan merugikan reputasi serta kepatuhan penjual yang sah.
- **Kesalahan Tipe II (Missed Uncertified):** Meloloskan produk tidak bersertifikat ke zona peninjauan manusia.

Oleh karena itu, **status negatif (`TERINDIKASI_TIDAK_BERSERTIFIKAT`) tidak pernah dirender tanpa tanggal snapshot DJID dan status verifikasi manusia pada elemen UI yang sama**, dan sistem **tidak pernah mengeksekusi penindakan otomatis** tanpa putusan analis pengawasan.

---

## 🏛️ Arsitektur Sistem

```mermaid
graph TD
    A[Scraper Marketplace] -->|ingest.py| B[(Database SQLite / PostgreSQL)]
    C[Basis Data DJID.csv] -->|ingest.py| B
    
    subgraph Core Engine: packages/ertriage
        D[text.py: Normalisasi & Noise Removal]
        E[brands.py: Deteksi Merek & Alias Kanonik]
        F[retrieval.py: Dual-Path Retrieval Aho-Corasick + FAISS + BM25]
        G[features.py: Ekstraksi Vektor 7/5 Fitur]
        H[triage.py: Decision Layer 6 Aturan Bisnis]
    end
    
    B --> Core Engine
    Core Engine --> I[FastAPI: apps/api]
    Core Engine --> J[Worker RQ: apps/worker]
    
    I -->|REST API| K[React 18 Dashboard & Review UI]
    K -->|Verifikasi Manusia| B
```

---

## 🚀 Panduan Memulai Cepat (Quickstart)

### 1. Persyaratan Sistem
- Python 3.11+
- Node.js 18+ (opsional untuk pengembangan frontend independen)

### 2. Instalasi Dependensi
```bash
# Clone repository dan masuk ke direktori
pip install -e .
pip install tabulate pytest pytest-cov
```

### 3. Ingest Data DJID & Listing Marketplace
```bash
# Ingest snapshot DJID resmi
python pipelines/ingest.py djid --file Artefak/DJID.csv --snapshot-date 2026-03-01

# Ingest data listing scraper marketplace
python pipelines/ingest.py marketplace --file Artefak/listing_marketplace.csv --source Tokopedia
```

### 4. Bangun Ulang Artefak & Model (Rebuild Pipeline)
```bash
python pipelines/build.py --djid Artefak/DJID.csv --listings Artefak/listing_marketplace.csv --output-dir Artefak
```

### 5. Evaluasi Retrieval & Kalibrasi
```bash
# Evaluasi Dense vs BM25 vs Hybrid RRF pada seluruh 1.019 listing
python pipelines/evaluate.py

# Kalibrasi ambang batas keputusan
python pipelines/calibrate.py
```

### 6. Menjalankan Aplikasi Web SITRUS
```bash
# Jalankan FastAPI server (melayani API dan UI frontend pada port 3001)
uvicorn apps.api.main:app --host 127.0.0.1 --port 3001
```
Buka peramban di: **`http://127.0.0.1:3001/`**

---

## 🧪 Menjalankan Pengujian (Test Suite)

Repositori ini dilengkapi dengan 36 suite unit test, integration test, dan **golden parity tests**:
```bash
pytest tests/ --cov=ertriage --cov=apps.api --cov-report=term-missing
```

### Fitur Golden Parity:
1. `tests/golden/test_feature_parity.py`: Memverifikasi vektor 7-fitur hasil `packages/ertriage/features.py` **100% byte-identical** terhadap `Artefak/dataset_fitur_final.csv`.
2. `tests/golden/test_rebuild_determinism.py`: Memverifikasi integritas seluruh artefak fisik terhadap checksum SHA-256 di `Artefak/manifest.json`.

---

## 📊 Hasil Benchmark Retrieval (Seluruh 1.019 Listing)

Evaluasi retrieval dihitung secara adil atas **seluruh listing marketplace** tanpa membuang listing non-match:

| Varian Retrieval | Recall@5 (GT) | Recall@10 (GT) | Recall@20 (GT) | Recall@50 (GT) | MRR (Seluruh Korpus) |
|:---|:---:|:---:|:---:|:---:|:---:|
| **Dense-Only (Standard Dokumen)** | 0.3316 | 0.4105 | 0.5368 | 0.6737 | 0.0490 |
| **Dense-Only (Merk + Model)** | 0.3842 | 0.4421 | 0.5263 | 0.6632 | 0.0528 |
| **Hybrid Retrieval (Dense + BM25 via RRF)** | **0.5211** | **0.6842** | **0.8105** | **0.9263** | **0.0793** |

*Hybrid retrieval meningkatkan Recall@20 sebesar +27.4% dan Recall@50 hingga 92.6% terutama pada nomor model alfanumerik spesifik (seperti `IC-V88`, `MD-T20`, `UV-5R`).*

---

## 📑 Ekspor Gold Set Anotasi Manusia

Untuk keperluan evaluasi berkala dan active learning:
```bash
python pipelines/export_goldset.py --output Artefak/gold_set_annotated.csv --format csv
```

---

## 🐳 Deployment Docker Compose

```bash
docker-compose up --build -d
```
Layanan akan tersedia di `http://localhost:3001`.
