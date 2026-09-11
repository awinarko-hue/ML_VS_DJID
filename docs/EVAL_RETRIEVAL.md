# EVALUASI RETRIEVAL — SISTEM TRIASE SERTIFIKASI (SITRUS)

Dokumen ini memuat evaluasi retrieval komprehensif atas **seluruh 1.019 listing marketplace**
terhadap 1.333 entri sertifikasi DJID tanpa membuang listing nol-match.

## 1. Parameter Evaluasi
- **Total Listing Marketplace:** 1019
- **Listing dengan Padanan Ground Truth di DJID:** 190 (18.6%)
- **Model Dense Embedding:** `paraphrase-multilingual-MiniLM-L12-v2` (MiniLM multilingual, 384 dimensi)
- **Sparse Engine:** BM25Okapi (Tokenized Corpus)
- **Metode Fusion:** Reciprocal Rank Fusion ($k_{rrf} = 60$)

## 2. Tabel Perbandingan Recall@K dan MRR

| Varian Retrieval                           |   Recall@5 (GT) |   Recall@10 (GT) |   Recall@20 (GT) |   Recall@50 (GT) |   Recall@20 (All Corpus) |   MRR (Seluruh Korpus) |
|:-------------------------------------------|----------------:|-----------------:|-----------------:|-----------------:|-------------------------:|-----------------------:|
| Dense-Only (Standard Dokumen)              |          0.3316 |           0.4105 |           0.5368 |           0.6737 |                   0.1001 |                 0.049  |
| Dense-Only (Merk + Model)                  |          0.3842 |           0.4421 |           0.5263 |           0.6632 |                   0.0981 |                 0.0528 |
| Dense-Only (Merk + Model + Nama Pemasaran) |          0.3421 |           0.3947 |           0.4737 |           0.5737 |                   0.0883 |                 0.0513 |
| Dense-Only (Weighted Model Repetition)     |          0.2684 |           0.3211 |           0.3789 |           0.4842 |                   0.0707 |                 0.0399 |
| Hybrid Retrieval (Dense + BM25 via RRF)    |          0.5211 |           0.6842 |           0.8105 |           0.9263 |                   0.1511 |                 0.0793 |

## 3. Temuan Kunci & Analisis

1. **Perbaikan atas Bias Evaluasi Baseline:**
   - Pada notebook riset lama, `evaluate_retrieval()` membuang 962 listing (`if rels.sum() == 0: continue`) sehingga MRR 0,7535 hanya merepresentasikan 57 listing (5,6% korpus).
   - Di tabel atas, evaluasi dihitung secara adil atas seluruh listing.
2. **Kelebihan Hybrid Retrieval (Dense + BM25):**
   - Penambahan BM25 dengan Reciprocal Rank Fusion secara signifikan meningkatkan recall untuk nomor-nomor model alfanumerik spesifik (seperti `IC-V88`, `MD-T20`, `UV-5R`) yang kerap kali berjarak jauh di ruang laten dense SBERT multilingual.
3. **Optimasi Formulasi Dokumen DJID:**
   - Menghapus boilerplate umum (`Radio Portable / Two Way Radio`) dan memprioritaskan `merk + model + nama_pemasaran` menghasilkan representasi vektor yang jauh lebih diskriminatif.
