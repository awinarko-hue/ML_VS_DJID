# AUDIT BASELINE — SISTEM TRIASE & PIPELINE RISET EKSISTING

Dokumen ini mendokumentasikan hasil audit teknis mendalam terhadap kode riset eksisting:
- `Entity_Resolution_SBERT_FAISS_XGBoost.ipynb` (Pipeline riset)
- `sistem_triase.py` (Decision layer produksi)
- `Sistem_Triase_Demo.ipynb` (Demo pemakaian)
- `sdppi_scraper_extension/` (Source code scraper Tokopedia & Shopee)
- `Artefak/` (`DJID.csv`, `listing_marketplace.csv`, model artifacts)

---

## 1. Ringkasan Eksekutif & Verifikasi Cacat Metodologis

Hasil pengujian pada notebook demo (`Sistem_Triase_Demo.ipynb` Sel 5) menunjukkan bahwa dari **1.019 listing marketplace**:
- **657 listing (64,5%)** diklasifikasikan sebagai `TERINDIKASI_TIDAK_BERSERTIFIKAT`.
- **192 listing (18,8%)** diklasifikasikan sebagai `TERSERTIFIKASI`.
- **170 listing (16,7%)** diklasifikasikan sebagai `PERLU_REVIEW`.

Tingkat indikasi negatif sebesar 64,5% ini sebagian besar dipicu oleh kelemahan metodologis sistem, bukan karena 64,5% produk di pasar benar-benar ilegal. Berikut adalah audit rinci yang memetakan setiap poin cacat.

---

## 2. Pemetaan & Analisis Cacat Metodologis (Sesuai Bagian 3 Spesifikasi)

### 2.1 Kegagalan Recall Retrieval (Prioritas Tertinggi)

| Temuan | Status Audit | Lokasi Kode / Bukti | Dampak Teknis & Risiko |
|---|---|---|---|
| **Evaluasi Retrieval Bias (Survival Bias)** | **Terkonfirmasi** | `Entity_Resolution_SBERT_FAISS_XGBoost.ipynb` Sel 28:<br>`if rels.sum() == 0: continue` | Hanya 57 listing yang memiliki match positif di Top-5 FAISS. Fungsi evaluasi membuang 962 listing lainnya dari perhitungan denominator. Angka MRR (0,7535) dan MAP@5 (0,7565) hanya merepresentasikan 5,6% korpus, menciptakan ilusi performa tinggi. |
| **Pencemaran Boilerplate Dokumen DJID** | **Terkonfirmasi** | `sistem_triase.py` baris 120–125 (`build_djid_document`) & Notebook Sel 9 | Field `nama_perangkat` ("Radio Portable / Two Way Radio") dan rentang frekuensi mendominasi representasi semantik SBERT, membuat 1.333 vektor DJID berdekatan di ruang laten dan menenggelamkan token model unik. |
| **Kegagalan SBERT pada Kode Alfanumerik Model** | **Terkonfirmasi** | `Sistem_Triase_Demo.ipynb` Sel 3 (Query `IC-V88`) & Notebook Sel 30 | Pada query `Radio HT ICOM IC-V88`, kandidat benar `ICOM IC-V88` tidak masuk Top-5 FAISS (skor cosine kalah dari entri lain seperti Hytera), dan `max_prob` hanya 0,027. SBERT multilingual generik tidak sensitif terhadap token alfanumerik spesifik. |
| **Duplikasi Slot Top-K oleh Varian Frekuensi** | **Terkonfirmasi** | `Artefak/DJID.csv` (misal model `IC-F5023H` terbit di VHF dan UHF sebagai baris terpisah) | Varian frekuensi model yang sama memakan beberapa slot Top-K sekaligus di FAISS (misal `IC-F5023H` muncul di rank 2 dan 3), mengurangi kuota retrieval untuk model lain yang relevan. |

**Tindakan Perbaikan:**
1. Evaluasi retrieval wajib menghitung **Recall@K (@5, @10, @20, @50)** atas seluruh 1.019 listing tanpa membuang listing nol-match.
2. Reformulasi dokumen DJID (menguji varian: `merk + model`, `merk + model + nama_pemasaran`, serta pembobotan repetisi token model).
3. Implementasi **Hybrid Retrieval (Dense SBERT FAISS + Sparse BM25 / Character n-gram TF-IDF)** menggunakan *Reciprocal Rank Fusion (RRF)*.
4. Deduplikasi entri DJID pada level `(merk_norm, model_norm)` untuk indexing, dengan pemetaan relasional 1-to-N ke seluruh nomor sertifikat terkait.

---

### 2.2 Sirkularitas Label & Pelatihan Classifier

| Temuan | Status Audit | Lokasi Kode / Bukti | Dampak Teknis & Risiko |
|---|---|---|---|
| **Sirkularitas Fitur dan Label Lemah (Tautologi)** | **Terkonfirmasi** | `Entity_Resolution_SBERT_FAISS_XGBoost.ipynb` Sel 17 & Sel 21 | Label positif lemah dibangun dari aturan `brand_same AND model_in_title`. Kemudian, 2 dari 7 fitur yang diberikan ke classifier adalah `brand_match` dan `model_in_title`. Model hanya mempelajari kembali aturan pembuatan label (F1 = 1,000 sempurna di Sel 24–25). |
| **Kegagalan Anotasi Manual & Kode Mati Filter `-1`** | **Terkonfirmasi** | `Entity_Resolution_SBERT_FAISS_XGBoost.ipynb` Sel 17 & Sel 19 | Cabang `else` di Sel 17 memberi `weak = 0` (bukan `-1`). Sebanyak 995 pasangan dengan `perlu_review = 1` diam-diam menjadi label negatif. Di Sel 19, file `pasangan_kandidat_untuk_anotasi (5).csv` diunggah dengan `Dibuang (-1): 0`. Filter `label != -1` menjadi kode mati. |
| **Data Leakage pada Train/Test Split** | **Terkonfirmasi** | `Entity_Resolution_SBERT_FAISS_XGBoost.ipynb` Sel 24:<br>`train_test_split(X, y, test_size=0.25)` | Split dilakukan per baris pasangan kandidat (5.095 baris), bukan per listing (`idx_listing`). Pasangan dari listing yang sama terdistribusi di kedua set train dan test, membocorkan konteks listing. |

**Tindakan Perbaikan:**
1. Zona 3-nilai eksplisit: `1` (positif terverifikasi/aturan ketat), `0` (negatif pasti), dan `-1` (ambigu/perlu review). Label `-1` wajib dibuang dari proses fitting classifier.
2. Split dataset wajib menggunakan `GroupShuffleSplit` atau `StratifiedGroupKFold` berdasarkan `idx_listing`.
3. Pemisahan konfigurasi fitur di kode:
   - `FEATURES_PRODUCTION` (7 fitur: `cosine_sim`, `levenshtein`, `jaccard`, `token_overlap`, `length_diff`, `brand_match`, `model_in_title`)
   - `FEATURES_EVALUABLE` (5 fitur: tanpa `brand_match` dan `model_in_title`)
4. Baseline wajib: `DummyClassifier`, TF-IDF Cosine, BM25, dan Pure Levenshtein/Fuzzy.
5. Modul antrean review manusia untuk memproduksi gold set independen.

---

### 2.3 Train/Serve Skew

| Temuan | Status Audit | Lokasi Kode / Bukti | Dampak Teknis & Risiko |
|---|---|---|---|
| **Ketidakkonsistenan Ambang Panjang Model** | **Terkonfirmasi** | `sistem_triase.py` baris 66 (`min_panjang_model: int = 4`) vs baris 116 (`len(m_norm) >= 3`) vs Notebook Sel 21 (`len(m_norm) >= 3`) | `model_lookup` di `sistem_triase.py` menyaring model $\ge 4$ karakter, tetapi `extract_features` mengekstrak fitur `model_in_title` dengan batas $\ge 3$ karakter. |
| **Inkonsistensi Penggunaan `data2` vs `judul_inti`** | **Terkonfirmasi** | Notebook Sel 7 (`judul_inti` dibentuk) vs Notebook Sel 21 (`p['judul_listing']` yang berisi `data2` mentah diteruskan ke `extract_features`) | Narasi di markdown menyatakan `judul_inti` (tanpa kata pemasaran) digunakan untuk fitur leksikal, namun implementasi riil mengekstrak fitur langsung dari `data2`. |

**Tindakan Perbaikan:**
1. Penyatuan konstanta tunggal di `packages/ertriage/config.py` (misal `MIN_MODEL_LENGTH = 3` atau `4` yang seragam di seluruh pipeline).
2. Standarisasi kontrak teks: `clean_text(judul_mentah)` digunakan untuk representasi, dan `normalize_model()` untuk pencocokan alfanumerik.
3. Pembuatan unit test `tests/golden/test_feature_parity.py` untuk menjamin kesesuaian vektor fitur antara pipeline training dan serving hingga tingkat presisi float.

---

### 2.4 Deteksi Merek dan Kasus Penghindaran Penjual

| Temuan | Status Audit | Lokasi Kode / Bukti | Dampak Teknis & Risiko |
|---|---|---|---|
| **Kode Mati pada Cabang `brand_q not in self.brands`** | **Terkonfirmasi** | `sistem_triase.py` baris 144–150 (`find_brand`) & baris 254–261 (`triase`) | `find_brand` melakukan iterasi hanya pada elemen `self.brands` (yang berasal dari `DJID.csv`). Akibatnya, `find_brand` tidak pernah bisa mengembalikan merek di luar `self.brands`. Cabang `if brand_q not in self.brands:` di baris 254 adalah **kode mati**. |
| **Kegagalan Menangani Alias / Evasion Penjual** | **Terkonfirmasi** | Dataset listing marketplace (contoh: listing "POFUNG", "MAG ONE") | Penjual menggunakan kata "POFUNG" (alias Baofeng) atau "MAG ONE by Motorola". Karena "POFUNG" tidak ada di `self.brands`, `find_brand` mengembalikan `None` dan jatuh ke `BRAND_TIDAK_TERDETEKSI` bukannya mendeteksi merek dan mengarahkannya ke kanonikal. |
| **Loop Regex Per Merek Inefisien** | **Terkonfirmasi** | `sistem_triase.py` baris 147–149 | Setiap query melakukan compile dan search regex berulang sebanyak jumlah unik brand DJID. |

**Tindakan Perbaikan:**
1. Pemisahan leksikon: `brands_djid` (dari database sertifikasi) dan `brands_market` (leksikon pasar yang mencakup alias).
2. Tabel basis data `brand_alias` yang dapat dikelola secara dinamis oleh analis pengawasan (`POFUNG` $\to$ `BAOFENG`, `MAG ONE` $\to$ `MOTOROLA`).
3. Pemilahan Reason Code yang tegas:
   - `BRAND_TIDAK_TERDETEKSI`: Teks listing tidak memuat merek yang dikenal sama sekali.
   - `BRAND_TIDAK_ADA_DI_DJID`: Merek terdeteksi di pasar (leksikon pasar), namun tidak memiliki izin edar/sertifikasi di DJID.
   - `MEREK_ADA_MODEL_TIDAK_DITEMUKAN`: Merek terdaftar di DJID, namun model spesifik tidak cocok secara eksak maupun semantik.
4. Kompilasi leksikon brand menjadi satu *regex alternation* atau *Aho-Corasick automaton*.

---

### 2.5 Performa, Skalabilitas, dan Ketahanan Sistem

| Temuan | Status Audit | Lokasi Kode / Bukti | Dampak Teknis & Risiko |
|---|---|---|---|
| **Linear Model Scan Inefisien** | **Terkonfirmasi** | `sistem_triase.py` baris 183–202 (`kandidat_eksak`) | Melakukan loop $O(N)$ Python murni terhadap 1.297 tuple model setiap kali ada query. Bila DJID memuat puluhan ribu sertifikat, ini menjadi bottleneck latensi. |
| **Komputasi Ganda Redundan** | **Terkonfirmasi** | `sistem_triase.py` baris 209–211 | `kandidat_semantik` (FAISS + 20 inferensi classifier) selalu dijalankan meskipun jalur eksak telah menemukan exact match definitif. |
| **Pemotongan Bukti Audit Trail** | **Terkonfirmasi** | `sistem_triase.py` baris 224–225 | `bukti_semantik` dipotong paksa `head(5)` padahal konfigurasi `top_k = 20`. Data Top-20 hilang dari audit trail. |
| **Pengecekan Integritas Lemah (`assert`)** | **Terkonfirmasi** | `sistem_triase.py` baris 323–325 | Menggunakan `assert index.ntotal == len(df_djid)` yang akan diabaikan jika Python dijalankan dengan flag optimasi `-O`. Selain itu hanya memeriksa jumlah baris, bukan integritas isi file. |
| **Ketergantungan pada File System `mtime`** | **Terkonfirmasi** | `sistem_triase.py` baris 338–339 | Menggunakan `st_mtime` dari file fisik, yang otomatis ter-reset setiap kali dilakukan `git checkout` atau clone baru. |

**Tindakan Perbaikan:**
1. Implementasi **Aho-Corasick automaton (`pyahocorasick`)** untuk pemindaian substring model dalam $O(L)$ waktu teks query.
2. Optimasi alur eksekusi: Jalur eksak dan semantik tetap terhubung, namun komputasi berat ditata efisien dengan seluruh Top-K (20 kandidat) disimpan utuh di audit trail JSONB.
3. Penggantian `assert` dengan exception eksplisit (`ArtifactIntegrityError`), dan validasi menggunakan **SHA-256 Checksum** atas konten dataset DJID.
4. Pencatatan tanggal snapshot secara eksplisit di tabel database `djid_snapshot`.
5. Logging terstruktur menggunakan modul `logging` standar Python (menghapus semua `print`).

---

## 3. Kesimpulan Audit

Seluruh 5 area cacat yang dirumuskan pada Spesifikasi Bagian 3 terkonfirmasi secara faktual di dalam kode sumber repo. Pipeline tidak boleh diporting langsung ke web app sebelum dilakukan refactoring dan restrukturisasi paket inti di `packages/ertriage`.
