const $ = id => document.getElementById(id);
const btnScrape = $('btn-scrape');
const btnScroll = $('btn-scroll');
const btnDiag   = $('btn-diag');
const btnImg    = $('btn-img');
const btnCsv    = $('btn-csv');
const btnJson   = $('btn-json');
const btnClear  = $('btn-clear');
const logEl     = $('log');
const progressW = $('progress-wrap');
const progressB = $('progress-bar');

let sessions = {};

/* ── Log ─────────────────────────────────────────────────────────────────── */
function log(msg, type = 'info') {
  const span = document.createElement('span');
  span.className = type;
  span.textContent = `[${new Date().toLocaleTimeString('id-ID')}] ${msg}`;
  logEl.innerHTML = '';
  logEl.appendChild(span);
}

/* ── Stats ───────────────────────────────────────────────────────────────── */
function updateStats(total) {
  $('stat-total').textContent   = total;
  $('stat-sellers').textContent = Object.keys(sessions).length;

  // Tampilkan tombol download gambar jika ada produk
  btnImg.style.display = total > 0 ? 'flex' : 'none';
}

function renderSessions() {
  const list    = $('session-list');
  const entries = Object.entries(sessions);
  if (!entries.length) {
    list.innerHTML = '<div style="color:#334155;font-size:11px">Belum ada sesi.</div>';
    return;
  }
  list.innerHTML = entries.map(([seller, count]) =>
    `<div class="session-item">
       <span class="session-seller" title="${seller}">${seller}</span>
       <span class="session-count">+${count}</span>
     </div>`).join('');
}

/* ── Deteksi platform ────────────────────────────────────────────────────── */
async function detectPlatform() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url   = tab?.url || '';
  const dot   = $('dot');

  if (url.includes('tokopedia.com')) {
    dot.className = 'dot ok';
    $('status-text').textContent = 'Tokopedia terdeteksi';
    $('platform-badge').innerHTML = '<span class="badge badge-toped">TOKOPEDIA</span>';
    return 'tokopedia';
  } else if (url.includes('shopee.co.id')) {
    dot.className = 'dot ok';
    $('status-text').textContent = 'Shopee terdeteksi';
    $('platform-badge').innerHTML = '<span class="badge badge-shopee">SHOPEE</span>';
    if (!url.includes('tab=shop') && !url.match(/-i\.\d+\.\d+/)) {
      $('nav-hint').style.display = 'block';
      $('nav-hint').innerHTML = '⚠️ <strong>Buka tab "Produk" dulu!</strong><br>URL yang benar: shopee.co.id/nama-seller<strong>?tab=shop&page=1</strong>';
    }
    return 'shopee';
  } else {
    dot.className = 'dot warn';
    $('status-text').textContent = 'Bukan halaman Tokopedia/Shopee';
    $('platform-badge').innerHTML = '<span class="badge badge-unknown">—</span>';
    btnScrape.disabled = true;
    btnScroll.disabled = true;
    return null;
  }
}

/* ── Init ────────────────────────────────────────────────────────────────── */
async function init() {
  await detectPlatform();
  chrome.runtime.sendMessage({ action: 'GET_ALL_PRODUCTS' }, res => {
    const prods = res?.products || [];
    prods.forEach(p => {
      const k = p._seller || 'unknown';
      sessions[k] = (sessions[k] || 0) + 1;
    });
    updateStats(prods.length);
    renderSessions();
    log(prods.length ? `${prods.length} produk dari sesi sebelumnya.` : 'Siap.', prods.length ? 'ok' : 'info');
  });
}

/* ── Auto-scroll ─────────────────────────────────────────────────────────── */
btnScroll.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  btnScroll.disabled = true;
  progressW.classList.add('show');
  progressB.style.width = '0%';
  log('Auto-scroll dimulai...', 'info');

  const ph = m => { if (m.action === 'SCROLL_PROGRESS') progressB.style.width = `${m.progress}%`; };
  chrome.runtime.onMessage.addListener(ph);

  chrome.tabs.sendMessage(tab.id, { action: 'AUTO_SCROLL' }, () => {
    chrome.runtime.onMessage.removeListener(ph);
    progressB.style.width = '100%';
    setTimeout(() => { progressW.classList.remove('show'); progressB.style.width = '0%'; }, 800);
    btnScroll.disabled = false;
    log('Scroll selesai. Klik Scrape.', 'ok');
  });
});

/* ── Scrape ──────────────────────────────────────────────────────────────── */
btnScrape.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  btnScrape.disabled = true;
  log('Scraping...', 'info');

  chrome.tabs.sendMessage(tab.id, { action: 'SCRAPE_PAGE' }, res => {
    if (chrome.runtime.lastError) {
      log('Error: ' + chrome.runtime.lastError.message, 'err');
      btnScrape.disabled = false; return;
    }
    if (res?.needsNavigation) {
      log('⚠️ ' + res.error, 'warn');
      $('nav-hint').style.display = 'block';
      $('nav-hint').innerHTML = `⚠️ <strong>Buka tab Produk dulu!</strong><br>
        URL: <a href="${res.hint}" style="color:#93c5fd">${res.hint}</a>`;
      btnScrape.disabled = false; return;
    }
    if (!res?.success) {
      log('Gagal: ' + (res?.error || 'Tidak ada respons'), 'err');
      btnScrape.disabled = false; return;
    }

    const products = res.products || [];
    $('stat-page').textContent = products.length;

    if (!products.length) {
      log('0 produk. Pastikan tab Produk aktif & sudah di-scroll.', 'warn');
      btnScrape.disabled = false; return;
    }

    $('nav-hint').style.display = 'none';

    chrome.runtime.sendMessage({ action: 'ADD_PRODUCTS', products }, addRes => {
      const total  = addRes?.total || 0;
      const added  = addRes?.added || 0;
      const seller = products[0]?._seller || 'unknown';
      sessions[seller] = (sessions[seller] || 0) + added;
      updateStats(total);
      renderSessions();
      log(`✅ +${added} produk dari "${seller}". Total: ${total}. Klik 🖼 untuk download gambar.`, 'ok');
      btnScrape.disabled = false;
    });
  });
});

/* ── Download Gambar ke Google Drive ─────────────────────────────────────────
 *
 * Alur:
 *   1. Kirim pesan DOWNLOAD_IMAGES ke background.js
 *   2. Background fetch setiap gambar dari CDN
 *   3. Convert ke base64, download via chrome.downloads
 *   4. File tersimpan di: Downloads\Tesis_SDPPI\images\<seller>\
 *   5. Jika folder Downloads = G:\My Drive\... → otomatis masuk Drive
 * ─────────────────────────────────────────────────────────────────────────── */
btnImg.addEventListener('click', async () => {
  // Cek jumlah gambar tersedia
  chrome.runtime.sendMessage({ action: 'GET_ALL_PRODUCTS' }, res => {
    const prods   = res?.products || [];
    const withImg = prods.filter(p => p.image && p.image.trim());

    if (!withImg.length) {
      log('Tidak ada URL gambar. Scrape produk dulu.', 'warn');
      return;
    }

    btnImg.disabled = true;
    btnImg.textContent = `🔄 Downloading 0 / ${withImg.length}...`;

    // Tampilkan panel progress
    const panel = $('img-progress');
    panel.style.display = 'block';
    $('img-prog-text').textContent  = `0 / ${withImg.length}`;
    $('img-prog-bar').style.width   = '0%';
    $('img-prog-detail').textContent = 'Memulai download...';
    $('img-prog-stats').textContent  = '';

    // Tampilkan info folder tujuan
    const seller  = withImg[0]?._seller || 'seller';
    $('drive-info').style.display = 'block';
    $('drive-path').textContent   = `Downloads\\Tesis_SDPPI\\images\\${seller}\\`;

    log(`🖼 Download ${withImg.length} gambar dimulai...`, 'info');

    // Listen progress dari background
    const progressHandler = (msg) => {
      if (msg.action !== 'IMAGE_DOWNLOAD_PROGRESS') return;
      const pct  = Math.round((msg.current / msg.total) * 100);
      $('img-prog-text').textContent  = `${msg.current} / ${msg.total}`;
      $('img-prog-bar').style.width   = pct + '%';
      $('img-prog-detail').textContent = msg.filename
        ? `Menyimpan: ...${msg.filename.split('/').pop()}`
        : 'Memproses...';
      $('img-prog-stats').textContent =
        `✅ ${msg.downloaded} berhasil  ❌ ${msg.failed} gagal  ⏱ ${msg.expired} expired`;
      btnImg.textContent = `🔄 ${msg.current} / ${msg.total}`;
    };
    chrome.runtime.onMessage.addListener(progressHandler);

    // Kirim perintah download ke background
    chrome.runtime.sendMessage({ action: 'DOWNLOAD_IMAGES' }, res => {
      chrome.runtime.onMessage.removeListener(progressHandler);
      btnImg.disabled = false;

      if (!res?.ok) {
        log('❌ Download gambar gagal: ' + (res?.error || ''), 'err');
        btnImg.textContent = '🖼 Download Gambar → Google Drive';
        return;
      }

      const { downloaded, failed, expired, total } = res;
      $('img-prog-bar').style.width = '100%';
      $('img-prog-detail').textContent = 'Selesai!';
      $('img-prog-stats').textContent =
        `✅ ${downloaded} berhasil  ❌ ${failed} gagal  ⏱ ${expired} expired`;

      btnImg.textContent = `✅ ${downloaded} gambar tersimpan`;
      log(
        `🖼 Selesai: ${downloaded}/${total} gambar. Folder: Downloads\\Tesis_SDPPI\\images\\`,
        downloaded > 0 ? 'ok' : 'warn'
      );

      if (expired > 0) {
        log(`⚠️ ${expired} URL expired (403). Download gambar SEGERA setelah scraping!`, 'warn');
      }
    });
  });
});

/* ── Diagnosa ────────────────────────────────────────────────────────────── */
btnDiag.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  log('Menjalankan diagnosa...', 'info');
  chrome.tabs.sendMessage(tab.id, { action: 'DIAGNOSE' }, res => {
    if (!res?.success) { log('Diagnosa gagal. Refresh halaman.', 'err'); return; }
    log(res.result.hint, res.result.linksFound > 0 || res.result.testidCardsFound > 0 ? 'ok' : 'warn');
  });
});

/* ── Kirim Langsung ke SITRUS API ────────────────────────────────────────── */
const btnSitrus = $('btn-sitrus');
if (btnSitrus) {
  btnSitrus.addEventListener('click', () => {
    log('Mengambil produk untuk dikirim ke SITRUS...', 'info');
    chrome.runtime.sendMessage({ action: 'GET_ALL_PRODUCTS' }, async res => {
      const prods = res?.products || [];
      if (!prods.length) {
        log('⚠️ Tidak ada produk. Lakukan scrape produk terlebih dahulu!', 'warn');
        return;
      }
      btnSitrus.disabled = true;
      btnSitrus.textContent = '⏳ Mengirim ke SITRUS...';
      log(`Mengirim ${prods.length} produk ke SITRUS (http://127.0.0.1:3001)...`, 'info');

      try {
        const resp = await fetch('http://127.0.0.1:3001/api/listings/ingest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            source: 'extension',
            auto_triage: true,
            items: prods.map(p => ({
              data2: p.nama || p.data2 || '',
              data: p.harga || p.data || '',
              web_scraper_start_url: p.url || p.web_scraper_start_url || '',
              image: p.gambar || p.image || '',
              seller: p._seller || p.seller || '',
            })),
          }),
        });

        const data = await resp.json();
        if (resp.ok && data.success) {
          log(`✅ Sukses! ${data.valid_listings} listing masuk SITRUS (Total: ${data.total_listings_now})`, 'ok');
        } else {
          log(`❌ Gagal kirim: ${data.detail || 'Error server'}`, 'err');
        }
      } catch (err) {
        log(`❌ Koneksi gagal: Pastikan SITRUS aktif di http://127.0.0.1:3001`, 'err');
      } finally {
        btnSitrus.disabled = false;
        btnSitrus.textContent = '🚀 Kirim Langsung ke SITRUS (API)';
      }
    });
  });
}

/* ── Download CSV ────────────────────────────────────────────────────────── */
btnCsv.addEventListener('click', () => {
  log('Menyimpan CSV ke Downloads\\Tesis_SDPPI\\csv\\...', 'info');
  chrome.runtime.sendMessage({ action: 'DOWNLOAD_CSV' }, res => {
    log(res?.ok ? '✅ CSV berhasil disimpan.' : '❌ ' + (res?.error||'Gagal.'), res?.ok ? 'ok' : 'err');
  });
});

/* ── Download JSON ───────────────────────────────────────────────────────── */
btnJson.addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: 'DOWNLOAD_JSON' }, res => {
    log(res?.ok ? '✅ JSON berhasil disimpan.' : '❌ ' + (res?.error||'Gagal.'), res?.ok ? 'ok' : 'err');
  });
});

/* ── Reset ───────────────────────────────────────────────────────────────── */
btnClear.addEventListener('click', () => {
  if (!confirm('Reset semua data scraping?')) return;
  chrome.runtime.sendMessage({ action: 'CLEAR_PRODUCTS' }, () => {
    sessions = {};
    updateStats(0);
    $('stat-page').textContent = 0;
    $('img-progress').style.display = 'none';
    $('drive-info').style.display   = 'none';
    btnImg.style.display = 'none';
    btnImg.textContent   = '🖼 Download Gambar → Google Drive';
    renderSessions();
    log('Data direset.', 'warn');
  });
});

init();

