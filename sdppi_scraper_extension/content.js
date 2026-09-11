/**
 * content.js — SDPPI Marketplace Scraper v6.0
 *
 * v6 — Perbaikan khusus Tokopedia + penguatan Shopee:
 *
 * TOKOPEDIA:
 *   - URL produk format: tokopedia.com/seller-name/nama-produk
 *   - Nama produk dari URL path (paling reliable, sama seperti fix Shopee)
 *   - Fallback: data-testid="spnSRPPrdName" → teks terpanjang di card
 *   - Harga: data-testid="spnSRPPrdPrice" → regex Rp
 *   - Gambar: img di dalam card (skip icon/logo)
 *
 * SHOPEE:
 *   - Tetap pakai a[href*="-i."] yang sudah terbukti di v5
 *   - Nama dari URL (-i. pattern) sebagai prioritas utama
 */

const HOST     = window.location.hostname;
const PLATFORM = HOST.includes('tokopedia') ? 'tokopedia'
               : HOST.includes('shopee')    ? 'shopee'
               : null;

/* ─── Utilitas umum ─────────────────────────────────────────────────────── */
function extractSeller(url) {
  try {
    const u = new URL(url);
    if (u.hostname.includes('tokopedia'))
      return u.pathname.split('/').filter(Boolean)[0] || 'unknown';
    if (u.hostname.includes('shopee'))
      return u.pathname.split('/').filter(Boolean)[0] || 'unknown';
  } catch(e) {}
  return 'unknown';
}

function findPrice(root) {
  // Coba data-testid dulu (Tokopedia)
  const priceEl = root.querySelector('[data-testid="spnSRPPrdPrice"], [data-testid="lblPDPDetailProductPrice"]');
  if (priceEl) return (priceEl.innerText || '').trim();
  // Regex fallback
  const text  = root.innerText || root.textContent || '';
  const match = text.match(/Rp[\s]?[\d.,]+/);
  return match ? match[0].replace(/\s/g, '') : '';
}

function findImage(root) {
  const imgs = root.querySelectorAll('img');
  for (const img of imgs) {
    const src = img.src || img.dataset.src || img.dataset.original || '';
    if (!src) continue;
    if (/icon|logo|avatar|banner|flag|star|rating|badge/i.test(src)) continue;
    if (img.naturalWidth && img.naturalWidth < 40) continue;
    return src;
  }
  return '';
}

function findPromo(root) {
  // Tokopedia: diskon, cashback
  const discountEl = root.querySelector('[data-testid="spnSRPPrdDiscount"], [class*="discount"], [class*="Discount"]');
  if (discountEl) {
    const t = (discountEl.innerText || '').trim();
    if (t) return t;
  }
  // Umum
  const text   = root.innerText || '';
  const promos = [];
  if (/mall/i.test(text))        promos.push('Mall');
  if (/\bori\b/i.test(text))     promos.push('ORI');
  if (/gratis/i.test(text))      promos.push('Gratis Ongkir');
  if (/cashback/i.test(text))    promos.push('Cashback');
  if (/voucher/i.test(text))     promos.push('Voucher');
  return promos.join(' | ');
}

/* ─── Nama dari URL Shopee ───────────────────────────────────────────────── */
// Format: /Nama-Produk-Panjang-i.12345.67890
function nameFromShopeeUrl(href) {
  try {
    const path = new URL(href).pathname;
    const m    = path.match(/^\/(.+)-i\.\d+\.\d+$/);
    if (m) return decodeURIComponent(m[1]).replace(/-/g, ' ').replace(/%20/g, ' ').trim();
  } catch(e) {}
  return '';
}

/* ─── Nama dari URL Tokopedia ────────────────────────────────────────────── */
// Format: tokopedia.com/seller-name/nama-produk-slug
function nameFromTokopediaUrl(href) {
  try {
    const parts = new URL(href).pathname.split('/').filter(Boolean);
    // parts[0] = seller, parts[1] = product-slug
    if (parts.length >= 2) {
      return parts[1]
        .replace(/-/g, ' ')
        .replace(/\?.*/, '')
        .trim();
    }
  } catch(e) {}
  return '';
}

/* ══════════════════════════════════════════════════════════════════════════
   TOKOPEDIA SCRAPER v6
   ══════════════════════════════════════════════════════════════════════════ */
function scrapeTokopedia() {
  const seller  = extractSeller(window.location.href);
  const pageUrl = window.location.href;

  console.log('[SDPPI v6] Tokopedia scrape dimulai:', pageUrl.substring(0, 60));

  /* ── Strategi 1: data-testid (paling stabil) ──────────────────────── */
  let cards = [...document.querySelectorAll('[data-testid="divProductWrapper"]')];
  console.log(`[SDPPI v6] S1 (data-testid): ${cards.length} kartu`);

  /* ── Strategi 2: link produk Tokopedia ───────────────────────────── */
  // Format URL produk: tokopedia.com/seller/nama-produk
  // Bukan: /product, /shop, /promo, /category
  const SKIP_PATHS = /\/(product|shop|promo|category|browse|hot|discovery|p\/|cart|checkout|account|login|register|help)/i;

  if (cards.length < 2) {
    const productLinks = new Map();
    document.querySelectorAll('a[href*="tokopedia.com/"]').forEach(a => {
      const href = a.href || '';
      if (!href) return;
      try {
        const u     = new URL(href);
        const parts = u.pathname.split('/').filter(Boolean);
        // Produk: path harus punya tepat 2 segmen (seller/produk) dan bukan skip path
        if (parts.length === 2 && !SKIP_PATHS.test(href) && a.querySelector('img')) {
          if (!productLinks.has(href)) productLinks.set(href, a);
        }
      } catch(e) {}
    });
    console.log(`[SDPPI v6] S2 (product links): ${productLinks.size} link`);

    if (productLinks.size >= 2) {
      // Konversi link ke card: naik ke parent yang punya harga
      const cardSet = new Set();
      for (const [href, anchor] of productLinks) {
        let node = anchor;
        for (let i = 0; i < 8; i++) {
          const p = node.parentElement;
          if (!p || (p.innerText || '').length > 1500) break;
          node = p;
          if (/Rp[\s]?\d/.test(node.innerText || '')) break;
        }
        cardSet.add(node);
      }
      cards = [...cardSet];
    }
  }

  /* ── Strategi 3: div dengan gambar + harga ────────────────────────── */
  if (cards.length < 2) {
    const byClass = {};
    document.querySelectorAll('div[class]').forEach(d => {
      const txt = d.innerText || '';
      if (!d.querySelector('img') || !/Rp[\s]?\d/.test(txt)) return;
      if (txt.length > 1000 || txt.length < 15) return;
      const cls = d.className.split(' ')[0];
      if (!byClass[cls]) byClass[cls] = [];
      byClass[cls].push(d);
    });
    const groups = Object.values(byClass).filter(g => g.length >= 3);
    if (groups.length) {
      cards = groups.sort((a, b) => b.length - a.length)[0];
      console.log(`[SDPPI v6] S3 (div+img+harga): ${cards.length} kartu`);
    }
  }

  if (cards.length === 0) {
    console.warn('[SDPPI v6] Tokopedia: tidak ada kartu produk ditemukan.');
    return { products: [], needsNavigation: false };
  }

  /* ── Proses kartu ──────────────────────────────────────────────────── */
  const products = [];
  const seen     = new Set();

  cards.forEach((card, i) => {
    // Nama: coba data-testid → URL dari link di dalam card → teks terpanjang
    let name = '';

    const nameEl = card.querySelector('[data-testid="spnSRPPrdName"]');
    if (nameEl) {
      name = (nameEl.innerText || '').trim();
    }

    if (!name) {
      // Cari link produk di dalam card lalu ambil nama dari URL
      const links = card.querySelectorAll('a[href*="tokopedia.com/"]');
      for (const link of links) {
        const n = nameFromTokopediaUrl(link.href);
        if (n && n.length > 5) { name = n; break; }
      }
    }

    if (!name) {
      // Teks terpanjang di dalam card (fallback)
      const cands = [...card.querySelectorAll('span, p, div')]
        .filter(el => el.children.length === 0)
        .map(el => (el.innerText || '').trim())
        .filter(t => t.length >= 10 && t.length <= 300
                  && !/^Rp/.test(t)
                  && !/^\d+(\.\d+)?$/.test(t)
                  && !/terjual|ulasan|bintang|rating/i.test(t));
      cands.sort((a, b) => b.length - a.length);
      name = cands[0] || '';
    }

    if (!name || name.length < 3) return;

    const key = name.substring(0, 40).toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);

    const price = findPrice(card);
    const img   = findImage(card);
    const promo = findPromo(card);

    products.push({
      web_scraper_order:     `${Date.now()}-${i + 1}`,
      web_scraper_start_url: pageUrl,
      data:                  price  || '',
      data2:                 name   || '',
      data3:                 promo  || '',
      image:                 img    || '',
      _platform:             'tokopedia',
      _seller:               seller,
      _scraped_at:           new Date().toISOString(),
    });
  });

  console.log(`[SDPPI v6] Tokopedia selesai: ${products.length} produk`);
  return { products, needsNavigation: false };
}

/* ══════════════════════════════════════════════════════════════════════════
   SHOPEE SCRAPER v6 (sama seperti v5 yang sudah terbukti)
   ══════════════════════════════════════════════════════════════════════════ */
function scrapeShopee() {
  const seller  = extractSeller(window.location.href);
  const pageUrl = window.location.href;

  const linkMap = new Map();
  document.querySelectorAll('a').forEach(a => {
    const href = a.href || '';
    if (href && /-i\.\d+\.\d+/.test(href) && !linkMap.has(href)) {
      linkMap.set(href, a);
    }
  });

  console.log(`[SDPPI v6] Shopee link ditemukan: ${linkMap.size}`);

  if (linkMap.size === 0) {
    return { products: [], needsNavigation: true, seller };
  }

  const products = [];
  const seen     = new Set();
  let idx        = 0;

  for (const [href, anchor] of linkMap) {
    let card       = anchor;
    let foundPrice = '';
    for (let level = 0; level < 10; level++) {
      const p = card.parentElement;
      if (!p) break;
      if ((p.innerText || '').length > 2000) break;
      card = p;
      const m = (p.innerText || '').match(/Rp[\s]?[\d.,]+/);
      if (m) foundPrice = m[0].replace(/\s/g, '');
    }

    let name = nameFromShopeeUrl(href);
    if (!name || name.length < 5) {
      const cands = [...card.querySelectorAll('span, div, p')]
        .filter(el => el.children.length <= 2)
        .map(el => (el.innerText || '').trim())
        .filter(t => t.length >= 10 && t.length <= 300
                  && !/^Rp/.test(t)
                  && !/terjual|ulasan|bintang/i.test(t));
      cands.sort((a, b) => b.length - a.length);
      name = cands[0] || '';
    }

    if (!name || name.length < 3) continue;
    const key = name.substring(0, 40).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    products.push({
      web_scraper_order:     `${Date.now()}-${++idx}`,
      web_scraper_start_url: pageUrl,
      data:                  foundPrice || findPrice(card) || '',
      data2:                 name       || '',
      data3:                 findPromo(card) || '',
      image:                 findImage(card) || '',
      _platform:             'shopee',
      _seller:               seller,
      _scraped_at:           new Date().toISOString(),
      _product_url:          href,
    });
  }

  console.log(`[SDPPI v6] Shopee selesai: ${products.length} produk`);
  return { products, needsNavigation: false };
}

/* ══════════════════════════════════════════════════════════════════════════
   DIAGNOSA v6
   ══════════════════════════════════════════════════════════════════════════ */
function runDiagnose() {
  const url = window.location.href;

  if (PLATFORM === 'shopee') {
    const links = [...document.querySelectorAll('a')]
      .filter(a => /-i\.\d+\.\d+/.test(a.href || ''));
    return {
      platform:    'shopee',
      url:         url.substring(0, 100),
      linksFound:  links.length,
      sampleLinks: links.slice(0, 3).map(a => a.href.substring(0, 80)),
      sampleNames: links.slice(0, 3).map(a => nameFromShopeeUrl(a.href)),
      hint: links.length > 0
        ? `✅ ${links.length} produk Shopee siap di-scrape.`
        : '⚠️ 0 link produk. Buka tab "Produk" seller: ?tab=shop&page=1',
    };
  }

  if (PLATFORM === 'tokopedia') {
    const testidCards = document.querySelectorAll('[data-testid="divProductWrapper"]');
    const SKIP = /\/(product|shop|promo|category|browse|hot|discovery|p\/|cart|checkout|account)/i;
    const prodLinks = [...document.querySelectorAll('a[href*="tokopedia.com/"]')]
      .filter(a => {
        try {
          const parts = new URL(a.href).pathname.split('/').filter(Boolean);
          return parts.length === 2 && !SKIP.test(a.href) && a.querySelector('img');
        } catch(e) { return false; }
      });

    return {
      platform:         'tokopedia',
      url:              url.substring(0, 100),
      testidCardsFound: testidCards.length,
      productLinksFound: prodLinks.length,
      sampleLinks:      prodLinks.slice(0, 3).map(a => a.href.substring(0, 80)),
      sampleNames:      prodLinks.slice(0, 3).map(a => nameFromTokopediaUrl(a.href)),
      hint: (testidCards.length > 0 || prodLinks.length > 0)
        ? `✅ ${testidCards.length} card (testid) + ${prodLinks.length} link produk ditemukan. Siap scrape.`
        : '⚠️ Tidak ada produk. Buka: tokopedia.com/nama-seller/product',
    };
  }

  return { platform: null, hint: '⚠️ Bukan halaman Tokopedia/Shopee.' };
}

/* ══════════════════════════════════════════════════════════════════════════
   SATU MESSAGE LISTENER
   ══════════════════════════════════════════════════════════════════════════ */
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {

  if (msg.action === 'SCRAPE_PAGE') {
    try {
      let result;
      if (PLATFORM === 'shopee') {
        result = scrapeShopee();
      } else if (PLATFORM === 'tokopedia') {
        result = scrapeTokopedia();
      } else {
        sendResponse({ success: false, error: 'Bukan halaman Tokopedia atau Shopee.' });
        return true;
      }

      if (result.needsNavigation) {
        sendResponse({
          success: false,
          needsNavigation: true,
          error: 'Buka tab "Produk" seller terlebih dahulu.',
          hint: `https://shopee.co.id/${result.seller}?tab=shop&page=1`,
        });
      } else {
        sendResponse({ success: true, products: result.products, platform: PLATFORM });
      }
    } catch(err) {
      console.error('[SDPPI v6]', err);
      sendResponse({ success: false, error: err.message });
    }
    return true;
  }

  if (msg.action === 'DIAGNOSE') {
    try { sendResponse({ success: true, result: runDiagnose() }); }
    catch(err) { sendResponse({ success: false, error: err.message }); }
    return true;
  }

  if (msg.action === 'AUTO_SCROLL') {
    const delay = ms => new Promise(r => setTimeout(r, ms));
    let lastH = 0, i = 0;
    (async function scroll() {
      while (i < 25) {
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
        await delay(1800);
        const h = document.body.scrollHeight;
        if (h === lastH) break;
        lastH = h; i++;
        try { chrome.runtime.sendMessage({ action: 'SCROLL_PROGRESS', progress: Math.min(i*4, 95) }); }
        catch(e) {}
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
      sendResponse({ done: true });
    })();
    return true;
  }

  return false;
});

console.log(`[SDPPI v6] Ready | ${PLATFORM || 'unknown'} | ${window.location.href.substring(0, 60)}`);
