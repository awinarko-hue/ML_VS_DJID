# SDPPI Marketplace Scraper — Browser Extension

Extension Chrome/Edge untuk scraping produk per seller di Tokopedia dan Shopee,
menghasilkan dataset dengan format identik `listing_marketplace.csv` untuk
keperluan penelitian deteksi sertifikasi SDPPI/DJID.

---

## Instalasi (Chrome / Edge / Brave)

1. Download dan ekstrak folder `sdppi_scraper_extension/`
2. Buka browser → ketik di address bar: `chrome://extensions`
3. Aktifkan **Developer mode** (toggle pojok kanan atas)
4. Klik **Load unpacked**
5. Pilih folder `sdppi_scraper_extension/`
6. Icon biru akan muncul di toolbar browser

---

## Cara Penggunaan

### Untuk Tokopedia
1. Buka halaman toko seller, contoh:
   `https://www.tokopedia.com/pusatht-official-store/product`
2. Klik icon extension → klik **Auto-scroll** (tunggu hingga selesai)
3. Klik **Scrape produk di halaman ini**
4. Ulangi untuk seller lain atau halaman berikutnya
5. Klik **⬇ CSV** untuk download dataset

### Untuk Shopee
1. Buka halaman toko seller, contoh:
   `https://shopee.co.id/ucomm.id`
2. Scroll manual atau klik **Auto-scroll**
3. Klik **Scrape produk di halaman ini**
4. Untuk halaman berikutnya: scroll ke bawah, tunggu load, scrape lagi

---

## Format Output CSV

File CSV yang dihasilkan memiliki kolom identik dengan `listing_marketplace.csv`:

| Kolom | Contoh Isi |
|-------|-----------|
| `web_scraper_order` | `1782458402-1` |
| `web_scraper_start_url` | `https://www.tokopedia.com/pusatht-official-store/product` |
| `data` | `Rp2.950.000` |
| `data2` | `Radio HT Handy Talky MagOne by Motorola X10d ...` |
| `data3` | `Hemat s.d 5% Pakai Bonus` |
| `image` | `https://images.tokopedia.net/img/...` |

File langsung bisa dipakai sebagai input notebook pipeline SDPPI tanpa modifikasi.

---

## Keterbatasan Teknis

### Anti-scraping Shopee/Tokopedia
- **Shopee** menggunakan CSS class yang di-obfuscate (mis. `._44qnta`) dan
  berubah setiap deploy. Jika selector gagal, extension akan fallback ke
  selector posisional.
- **Tokopedia** menggunakan React dengan lazy loading. Pastikan Auto-scroll
  selesai sebelum scrape.
- Kedua platform memblokir scraping otomatis headless. Extension ini berjalan
  di browser normal (tidak headless) sehingga lebih sulit dideteksi.

### Gambar produk
- URL gambar dari Tokopedia/Shopee adalah CDN langsung (bukan Google Drive
  seperti dataset awal). Kolom `image` akan berisi URL CDN.
- Untuk menyimpan gambar secara lokal, tambahkan langkah download manual
  atau menggunakan Python script terpisah.

### Pagination Shopee
- Shopee memuat produk via infinite scroll atau tombol halaman.
- Untuk mendapatkan semua produk: klik halaman berikutnya →
  tunggu load → klik Scrape → ulangi.

---

## Menggabungkan dengan Dataset Lama

Di Google Colab, gabungkan CSV baru dengan dataset lama:

```python
import pandas as pd
import glob

# Load semua CSV hasil scraping
files = glob.glob('listing_marketplace_*.csv')
dfs = [pd.read_csv(f) for f in files]

# Gabungkan dan deduplikasi
df_all = pd.concat(dfs, ignore_index=True)
df_all = df_all.drop_duplicates(subset=['data2', 'web_scraper_start_url'])
df_all = df_all.reset_index(drop=True)
df_all['web_scraper_order'] = [f'{1782458402}-{i+1}' for i in range(len(df_all))]

df_all.to_csv('listing_marketplace_combined.csv', index=False, encoding='utf-8-sig')
print(f'Total: {len(df_all)} produk dari {df_all["web_scraper_start_url"].nunique()} URL')
```

---

## Struktur File Extension

```
sdppi_scraper_extension/
├── manifest.json    ← Konfigurasi extension (Manifest V3)
├── content.js       ← Scraper yang diinjeksi ke halaman Tokopedia/Shopee
├── background.js    ← Service worker: storage, download CSV
├── popup.html       ← UI popup extension
├── popup.js         ← Controller popup
├── icon16.png       ← Icon kecil
├── icon48.png       ← Icon toolbar
└── icon128.png      ← Icon besar
```
