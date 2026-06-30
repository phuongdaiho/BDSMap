/**
 * Cloudflare Worker — BDS Map Share
 * Deploy: https://dash.cloudflare.com → Workers & Pages → Create Worker
 * URL:    https://bdsmap-share.YOUR_CF_USERNAME.workers.dev/?id=LOCATION_ID
 */

const PROJECT       = 'bdsmap-3b584';
const API_KEY       = 'AIzaSyBuuxnR8w8Sd2VSuMfU8Sx7S3aoYLWneD8';
const APP_URL       = 'https://phuongdaiho.github.io/BDSMap/';
const DEFAULT_IMAGE = 'https://phuongdaiho.github.io/BDSMap/icons/icon-512.png';

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const id  = url.searchParams.get('id');

    if (!id) return Response.redirect(APP_URL, 302);

    const appUrl = `${APP_URL}?share=${encodeURIComponent(id)}`;

    // Fetch location from Firestore REST API (3s timeout)
    let loc = null;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3000);
      const fsUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/public_locations/${encodeURIComponent(id)}?key=${API_KEY}`;
      const res = await fetch(fsUrl, {
        signal: controller.signal,
        cf: { cacheEverything: true, cacheTtl: 60 },
      });
      clearTimeout(timer);
      if (res.ok) loc = parseDoc(await res.json());
    } catch (_) {}

    // Build OG data — fallback to app defaults if Firestore unreachable
    const title = loc?.name  || 'BĐS đang bán — BĐS Map';
    const parts = loc ? [loc.price, loc.acreage ? loc.acreage + ' m²' : '', loc.area, loc.status || 'Đang bán'] : [];
    const desc  = parts.filter(Boolean).join(' · ') || 'Xem thông tin BĐS đang bán gần bạn trên BĐS Map';
    const httpImages = (loc?.images || []).filter(i => i && i.startsWith('http'));
    const httpImage  = httpImages[0] || (loc?.image?.startsWith('http') ? loc.image : null);
    const image = httpImage || DEFAULT_IMAGE;
    const isDefault = image === DEFAULT_IMAGE;
    const card  = isDefault ? 'summary' : 'summary_large_image';

    // IMPORTANT: NO <meta http-equiv="refresh"> — bots would follow it to GitHub Pages
    // Use JS-only redirect so real users get sent to the app but bots stay on this page
    const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <title>${esc(title)}</title>

  <!-- Open Graph (Facebook, Zalo, Telegram…) -->
  <meta property="og:type"         content="website" />
  <meta property="og:site_name"    content="BĐS Map" />
  <meta property="og:url"          content="${esc(appUrl)}" />
  <meta property="og:title"        content="${esc(title)}" />
  <meta property="og:description"  content="${esc(desc)}" />
  <meta property="og:image"        content="${esc(image)}" />
  <meta property="og:image:width"  content="${card === 'summary_large_image' ? '1200' : '512'}" />
  <meta property="og:image:height" content="${card === 'summary_large_image' ? '630'  : '512'}" />
  <meta property="og:image:type"   content="${isDefault ? 'image/png' : 'image/jpeg'}" />
  <meta property="og:locale"       content="vi_VN" />

  <!-- Twitter / X -->
  <meta name="twitter:card"        content="${card}" />
  <meta name="twitter:title"       content="${esc(title)}" />
  <meta name="twitter:description" content="${esc(desc)}" />
  <meta name="twitter:image"       content="${esc(image)}" />
</head>
<body style="font-family:sans-serif;padding:20px;color:#333;max-width:480px;margin:60px auto;text-align:center">
  <img src="${esc(image)}" alt="" style="width:100%;max-height:300px;object-fit:cover;border-radius:12px;margin-bottom:16px" />
  <h2 style="margin:0 0 6px;color:#1a73e8">${esc(title)}</h2>
  <p style="margin:0 0 20px;color:#555">${esc(desc)}</p>
  <a href="${esc(appUrl)}" style="background:#1a73e8;color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:1rem">
    Xem trên BĐS Map →
  </a>
  <script>
    // JS redirect — bots (facebookexternalhit, Zalo…) don't run JS so they stay here and read OG tags
    window.location.replace(${JSON.stringify(appUrl)});
  <\/script>
</body>
</html>`;

    return new Response(html, {
      headers: {
        'Content-Type':  'text/html;charset=utf-8',
        'Cache-Control': 'public, max-age=60',
      },
    });
  },
};

function parseDoc(doc) {
  if (!doc || !doc.fields) return null;
  const f   = doc.fields;
  const str = k => f[k]?.stringValue || '';
  const num = k => f[k]?.doubleValue ?? f[k]?.integerValue ?? 0;
  const arr = k => (f[k]?.arrayValue?.values || []).map(v => v.stringValue || '').filter(Boolean);
  return {
    name:    str('name'),    price:   str('price'),
    area:    str('area'),    acreage: str('acreage'),
    status:  str('status'),  image:   str('image'),
    images:  arr('images'),  lat:     num('lat'),
    lng:     num('lng'),
  };
}

function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
