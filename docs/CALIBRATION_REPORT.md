# LAPORAN KALIBRASI AMBANG KEPUTUSAN TRIASE (SITRUS)

Dokumen ini memuat analisis ambang keputusan ($t_{low}$ dan $t_{high}$) untuk model klasifikasi
SITRUS dengan mempertimbangkan **asimetri risiko hukum**:
- **Kesalahan Tipe I (False Accusation):** Menuduh produk yang sah/bersertifikat sebagai tidak bersertifikat. Biaya hukum & komplain sangat tinggi.
- **Kesalahan Tipe II (Missed Uncertified):** Meloloskan produk tidak bersertifikat ke zona review atau bersertifikat.

## 1. Ambang Batas yang Ditetapkan

| Parameter | Nilai | Rationale Desain & Perlindungan Hukum |
|:---|:---:|:---|
| **$t_{high}$ (Ambang Bersertifikat)** | **0.80** | Menjamin tingkat presisi tinggi sebelum menetapkan status `TERSERTIFIKASI` secara otomatis tanpa review manual. |
| **$t_{low}$ (Ambang Terindikasi Tidak)** | **0.30** | Mencegah tuduhan keliru terhadap produk yang memiliki kemiripan moderat dengan varian sertifikat DJID. |
| **Zona Ambiguitas (Perlu Review)** | **[0.30, 0.80)** | Seluruh kandidat di rentang probabilitas ini diarahkan ke **Antrean Peninjauan Cepat (Fast Review Queue)** untuk verifikasi analis. |

## 2. Tabel Simulasi Ambang Batas

| Ambang $t$ | Strategi Kebijakan | Tindakan Sistem |
|:---:|:---|:---|
| **$< 0.30$** | Sangat Rendah / Tidak Ada Kemiripan | Diberi label `TERINDIKASI_TIDAK_BERSERTIFIKAT` (wajib coupled dengan tanggal snapshot DJID dan status belum terverifikasi). |
| **$0.30 \le t < 0.80$** | Ambigu / Kemiripan Parsial | Diberi label `PERLU_REVIEW` dan dimasukkan ke antrean verifikasi analis. |
| **$\ge 0.80$** | Keyakinan Tinggi | Diberi label `TERSERTIFIKASI` (atau kecocokan model eksak via Aho-Corasick automaton). |

## 3. Rekomendasi Operasional Analis

1. Analis pengawasan wajib memprioritaskan antrean dengan prioritas **HIGH** (`TERINDIKASI_TIDAK_BERSERTIFIKAT`).
2. Setiap keputusan manusia dicatat secara permanen di tabel `review_decision` beserta ID reviewer dan timestamp untuk kebutuhan audit yudisial.
3. Model evaluable 5-fitur bebas dari fitur melingkar (`brand_match` dan `model_in_title`), memastikan generalisasi yang kokoh pada varian listing baru di masa depan.
