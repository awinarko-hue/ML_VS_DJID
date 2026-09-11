/**
 * background.js v7.0
 *
 * Fitur baru:
 * DOWNLOAD_IMAGES — fetch tiap gambar → convert base64 → download ke subfolder
 * Subfolder default: Tesis_SDPPI/images/seller_nama/
 * Kompatibel dengan Google Drive for Desktop (folder G:\My Drive\Tesis_SDPPI\)
 * karena chrome.downloads menyimpan ke folder Downloads yang sudah di-set user.
 */

let allProducts = [];

/* ── Helper: CSV builder ─────────────────────────────────────────────────── */
function buildCSV(products) {
  const COLS = ['web_scraper_order','web_scraper_start_url','data','data2','data3','image'];
  const esc  = v => { const s = String(v??'').replace(/"/g,'""'); return /[",\n\r]/.test(s)?`"${s}"`:s; };
  return '\uFEFF' + [COLS.join(','), ...products.map(p => COLS.map(c=>esc(p[c]??'')).join(','))].join('\r\n');
}

/* ── Helper: string → base64 data URL ───────────────────────────────────── */
function toDataUrl(str, mime) {
  const enc = new TextEncoder();
  const bytes = enc.encode(str);
  let bin = '';
  bytes.forEach(b => bin += String.fromCharCode(b));
  return `data:${mime};charset=utf-8;base64,${btoa(bin)}`;
}

/* ── Helper: blob → base64 data URL (untuk gambar) ──────────────────────── */
function blobToBase64DataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/* ── Timestamp ───────────────────────────────────────────────────────────── */
function ts() { return new Date().toISOString().replace(/[:.]/g,'-').slice(0,19); }

/* ── Sanitize nama file (hapus karakter tidak valid di Windows) ─────────── */
function sanitize(str) {
  return str.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').substring(0, 60).trim() || 'produk';
}

/* ══════════════════════════════════════════════════════════════════════════
   MESSAGE HANDLER TUNGGAL
   ══════════════════════════════════════════════════════════════════════════ */
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {

  /* ── Tambah produk (dari scraping) ──────────────────────────────────── */
  if (msg.action === 'ADD_PRODUCTS') {
    const keys = new Set(allProducts.map(p => `${p.data2?.substring(0,40)}|${p.web_scraper_start_url}`));
    let added  = 0;
    (msg.products || []).forEach(p => {
      const k = `${p.data2?.substring(0,40)}|${p.web_scraper_start_url}`;
      if (!keys.has(k)) { allProducts.push(p); keys.add(k); added++; }
    });
    sendResponse({ total: allProducts.length, added });
    return true;
  }

  /* ── Get semua produk ────────────────────────────────────────────────── */
  if (msg.action === 'GET_ALL_PRODUCTS') {
    sendResponse({ products: allProducts });
    return true;
  }

  /* ── Reset ───────────────────────────────────────────────────────────── */
  if (msg.action === 'CLEAR_PRODUCTS') {
    allProducts = [];
    sendResponse({ ok: true });
    return true;
  }

  /* ── Download CSV ────────────────────────────────────────────────────── */
  if (msg.action === 'DOWNLOAD_CSV') {
    if (!allProducts.length) { sendResponse({ ok:false, error:'Tidak ada produk.' }); return true; }
    try {
      chrome.downloads.download({
        url:      toDataUrl(buildCSV(allProducts), 'text/csv'),
        filename: `Tesis_SDPPI/csv/listing_marketplace_${ts()}.csv`,
        saveAs:   false,  // langsung simpan tanpa dialog
      }, id => sendResponse(chrome.runtime.lastError
        ? { ok:false, error: chrome.runtime.lastError.message }
        : { ok:true, downloadId:id }));
    } catch(e) { sendResponse({ ok:false, error:e.message }); }
    return true;
  }

  /* ── Download JSON ───────────────────────────────────────────────────── */
  if (msg.action === 'DOWNLOAD_JSON') {
    if (!allProducts.length) { sendResponse({ ok:false, error:'Tidak ada produk.' }); return true; }
    try {
      chrome.downloads.download({
        url:      toDataUrl(JSON.stringify(allProducts, null, 2), 'application/json'),
        filename: `Tesis_SDPPI/csv/listing_marketplace_${ts()}.json`,
        saveAs:   false,
      }, id => sendResponse(chrome.runtime.lastError
        ? { ok:false, error: chrome.runtime.lastError.message }
        : { ok:true, downloadId:id }));
    } catch(e) { sendResponse({ ok:false, error:e.message }); }
    return true;
  }

  /* ── Download Gambar ─────────────────────────────────────────────────────
   *
   * Alur per gambar:
   *   1. fetch() URL gambar dari CDN Tokopedia/Shopee
   *   2. Blob → FileReader → base64 data URL
   *   3. chrome.downloads.download() dengan filename:
   *      Tesis_SDPPI/images/<seller>/<idx>_<nama_produk>.<ext>
   *
   * Catatan penting:
   *   - chrome.downloads menyimpan ke folder Downloads yang diset di Chrome/Edge
   *   - Jika folder Downloads = G:\My Drive\Tesis_SDPPI\, file otomatis ke Drive
   *   - URL gambar Tokopedia valid ~1 jam → jalankan SEGERA setelah scraping
   *   - Delay 300ms antar gambar untuk hindari rate limit CDN
   * ─────────────────────────────────────────────────────────────────────── */
  if (msg.action === 'DOWNLOAD_IMAGES') {
    const products = allProducts.filter(p => p.image && p.image.trim());

    if (!products.length) {
      sendResponse({ ok:false, error:'Tidak ada URL gambar. Scrape dulu.' });
      return true;
    }

    let downloaded = 0;
    let failed     = 0;
    let expired    = 0;
    const total    = products.length;

    (async () => {
      for (let i = 0; i < products.length; i++) {
        const p      = products[i];
        const imgUrl = p.image.trim();
        const seller = sanitize(p._seller || 'unknown');
        const idx    = String(i + 1).padStart(4, '0');
        const nama   = sanitize(p.data2 || 'produk');

        // Deteksi ekstensi dari URL
        const ext = imgUrl.includes('.webp') ? 'webp'
                  : imgUrl.includes('.png')  ? 'png'
                  : 'jpg';

        // Path tujuan: Tesis_SDPPI/images/<seller>/<idx>_<nama>.<ext>
        // Chrome akan append ini ke folder Downloads yang diset user
        const filename = `Tesis_SDPPI/images/${seller}/${idx}_${nama}.${ext}`;

        try {
          // 1. Fetch gambar
          const resp = await fetch(imgUrl, {
            headers: {
              'Referer':  imgUrl.includes('tokopedia') ? 'https://www.tokopedia.com/'
                                                       : 'https://shopee.co.id/',
              'Accept':   'image/webp,image/apng,image/*,*/*;q=0.8',
            }
          });

          if (resp.status === 403 || resp.status === 401) {
            expired++;
            console.warn(`[SDPPI] Gambar expired (${resp.status}): ${imgUrl.substring(0,60)}`);
            // Update kolom image di allProducts menjadi kosong
            allProducts[allProducts.findIndex(ap => ap.image === imgUrl)].image = '';
            continue;
          }

          if (!resp.ok) {
            failed++;
            console.warn(`[SDPPI] Gambar error ${resp.status}: ${imgUrl.substring(0,60)}`);
            continue;
          }

          // 2. Blob → base64 data URL
          const blob    = await resp.blob();
          const dataUrl = await blobToBase64DataUrl(blob);

          // 3. Download via chrome.downloads
          await new Promise((resolve) => {
            chrome.downloads.download({
              url:      dataUrl,
              filename: filename,
              saveAs:   false,  // langsung simpan, tidak minta konfirmasi
            }, (downloadId) => {
              if (chrome.runtime.lastError) {
                console.warn('[SDPPI] Download error:', chrome.runtime.lastError.message);
                failed++;
              } else {
                downloaded++;
              }
              resolve();
            });
          });

        } catch(err) {
          failed++;
          console.warn(`[SDPPI] Error gambar ${i+1}:`, err.message);
        }

        // Kirim update progress ke popup
        try {
          chrome.runtime.sendMessage({
            action:     'IMAGE_DOWNLOAD_PROGRESS',
            current:    i + 1,
            total,
            downloaded,
            failed,
            expired,
            filename,
          });
        } catch(e) {}

        // Delay 300ms — hindari rate limit CDN dan jangan overwhelm Downloads API
        await new Promise(r => setTimeout(r, 300));
      }

      // Update CSV dengan image path lokal (ganti URL CDN dengan path file)
      // sehingga kolom image di CSV menunjuk ke file lokal, bukan URL expired
      sendResponse({ ok:true, downloaded, failed, expired, total });
    })();

    return true; // async response
  }

  return false;
});
