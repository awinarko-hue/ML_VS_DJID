# SITRUS — Sistem Triase Sertifikasi Perangkat (Device Certification Triage System)

**SITRUS (Sistem Triase Sertifikasi Perangkat)** is an internal web platform that helps spectrum monitoring and device standardization analysts (DJID / Balmon, Kementerian Komunikasi dan Informatika — the Indonesian Ministry of Communications and Informatics) screen marketplace listings against the DJID telecommunications device certification database: automatically, accurately, and in a way that can be defended legally.

---

## ⚖️ The Legal Asymmetry Principle

This system's output carries direct **legal consequences** for shop and listing owners:
- **Type I error (false accusation):** flagging a genuinely certified product as "uncertified". This error is extremely costly and damages both the reputation and the compliance record of legitimate sellers.
- **Type II error (missed uncertified device):** letting an uncertified product through to the human review queue.

For that reason, a negative status (`TERINDIKASI_TIDAK_BERSERTIFIKAT`) **is never rendered without the DJID snapshot date and the human verification status appearing in the same UI element**, and the system **never carries out automated enforcement** without a ruling from a monitoring analyst.

---

## 🏛️ System Architecture

```mermaid
graph TD
    A[Marketplace Scraper] -->|ingest.py| B[(SQLite / PostgreSQL Database)]
    C[DJID.csv Certification Database] -->|ingest.py| B
    
    subgraph Core Engine: packages/ertriage
        D[text.py: Normalization & Noise Removal]
        E[brands.py: Brand Detection & Canonical Aliases]
        F[retrieval.py: Dual-Path Retrieval Aho-Corasick + FAISS + BM25]
        G[features.py: 7/5 Feature Vector Extraction]
        H[triage.py: Decision Layer, 6 Business Rules]
    end
    
    B --> Core Engine
    Core Engine --> I[FastAPI: apps/api]
    Core Engine --> J[RQ Worker: apps/worker]
    
    I -->|REST API| K[React 18 Dashboard & Review UI]
    K -->|Human Verification| B
```

---

## 🚀 Quickstart

### 1. System Requirements
- Python 3.11+
- Node.js 18+ (optional, for standalone frontend development)

### 2. Installing Dependencies
```bash
# Clone the repository and enter the directory
pip install -e .
pip install tabulate pytest pytest-cov
```

### 3. Ingesting DJID Data and Marketplace Listings
```bash
# Ingest the official DJID snapshot
python pipelines/ingest.py djid --file Artefak/DJID.csv --snapshot-date 2026-03-01

# Ingest scraped marketplace listing data
python pipelines/ingest.py marketplace --file Artefak/listing_marketplace.csv --source Tokopedia
```

### 4. Rebuilding Artifacts and Models (Rebuild Pipeline)
```bash
python pipelines/build.py --djid Artefak/DJID.csv --listings Artefak/listing_marketplace.csv --output-dir Artefak
```

### 5. Retrieval Evaluation and Calibration
```bash
# Evaluate Dense vs BM25 vs Hybrid RRF across all 1,019 listings
python pipelines/evaluate.py

# Calibrate the decision thresholds
python pipelines/calibrate.py
```

### 6. Running the SITRUS Web Application
```bash
# Start the FastAPI server (serves both the API and the frontend UI on port 3001)
uvicorn apps.api.main:app --host 127.0.0.1 --port 3001
```
Open your browser at: **`http://127.0.0.1:3001/`**

---

## 🧪 Running the Test Suite

The repository ships with 36 unit, integration, and **golden parity** test suites:
```bash
pytest tests/ --cov=ertriage --cov=apps.api --cov-report=term-missing
```

### Golden Parity Features:
1. `tests/golden/test_feature_parity.py`: verifies that the 7-feature vectors produced by `packages/ertriage/features.py` are **100% byte-identical** to `Artefak/dataset_fitur_final.csv`.
2. `tests/golden/test_rebuild_determinism.py`: verifies the integrity of every physical artifact against the SHA-256 checksums in `Artefak/manifest.json`.

---

## 📊 Retrieval Benchmark Results (All 1,019 Listings)

Retrieval metrics are computed fairly across **every marketplace listing**, without discarding non-matching listings:

| Retrieval Variant | Recall@5 (GT) | Recall@10 (GT) | Recall@20 (GT) | Recall@50 (GT) | MRR (Full Corpus) |
|:---|:---:|:---:|:---:|:---:|:---:|
| **Dense-Only (Standard Document)** | 0.3316 | 0.4105 | 0.5368 | 0.6737 | 0.0490 |
| **Dense-Only (Brand + Model)** | 0.3842 | 0.4421 | 0.5263 | 0.6632 | 0.0528 |
| **Hybrid Retrieval (Dense + BM25 via RRF)** | **0.5211** | **0.6842** | **0.8105** | **0.9263** | **0.0793** |

*Hybrid retrieval improves Recall@20 by +27.4% and pushes Recall@50 to 92.6%, most notably on specific alphanumeric model numbers such as `IC-V88`, `MD-T20`, and `UV-5R`.*

---

## 📑 Exporting the Human-Annotated Gold Set

For periodic evaluation and active learning:
```bash
python pipelines/export_goldset.py --output Artefak/gold_set_annotated.csv --format csv
```

---

## 🐳 Docker Compose Deployment

```bash
docker-compose up --build -d
```
The services will be available at `http://localhost:3001`.

## 🐳 Deployment Docker Compose

```bash
docker-compose up --build -d
```
Layanan akan tersedia di `http://localhost:3001`.
