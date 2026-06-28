/**
 * Cloudflare Worker — BDS Map Share
 * Deploy: https://dash.cloudflare.com → Workers & Pages → Create Worker
 * URL:    https://bdsmap-share.YOUR_CF_USERNAME.workers.dev/?id=LOCATION_ID
 */

const PROJECT  = 'bdsmap-3b584';
const API_KEY  = 'AIzaSyBuuxnR8w8Sd2VSuMfU8Sx7S3aoYLWneD8';
const APP_URL  = 'https://phuongdaiho.github.io/BDSMap/';

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const id  = url.searchParams.get('id');

    if (!id) return Response.redirect(APP_URL, 302);

    const fsUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/public_locations/${encodeURIComponent(id)}?key=${API_KEY}`;
    let loc = null;
    try {
      const res = await fetch(fsUrl, { cf: { cacheEverything: true, cacheTtl: 60 } });
      if (res.ok) loc = parseDoc(await res.json());
    } catch (_) {}

    const appUrl = `${APP_URL}?share=${encodeURIComponent(id)}`;
    if (!loc) return Response.redirect(appUrl, 302);

    const title = loc.name || 'BĐS đang bán';
    const desc  = [
      loc.price,
      loc.acreage ? loc.acreage + ' m²' : '',
      loc.area,
      loc.status || 'Đang bán',
    ].filter(Boolean).join(' · ');
    const image = (loc.images && loc.images[0]) || loc.image || '';

    const og = (prop, content) =>
      content ? `  <meta property="${prop}" content="${escHtml(content)}" />\n` : '';
    const tw = (name, content) =>
      content ? `  <meta name="${name}" content="${escHtml(content)}" />\n` : '';

    const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <title>${escHtml(title)}</title>
${og('og:type',        'website')}
${og('og:site_name',   'BĐS Map')}
${og('og:url',         appUrl)}
${og('og:title',       title)}
${og('og:description', desc || 'Xem chi tiết BĐS trên BĐS Map')}
${og('og:image',       image)}
${tw('twitter:card',        image ? 'summary_large_image' : 'summary')}
${tw('twitter:title',       title)}
${tw('twitter:description', desc || 'Xem chi tiết BĐS trên BĐS Map')}
${tw('twitter:image',       image)}
  <meta http-equiv="refresh" content="0;url=${escHtml(appUrl)}" />
</head>
<body style="font-family:sans-serif;padding:20px;color:#333">
  <p>Đang chuyển hướng đến BĐS Map…</p>
  <p><a href="${escHtml(appUrl)}">Nhấn vào đây nếu không tự động chuyển</a></p>
  <script>window.location.replace(${JSON.stringify(appUrl)});<\/script>
</body>
</html>`;

    return new Response(html, {
      headers: { 'Content-Type': 'text/html;charset=utf-8', 'Cache-Control': 'public, max-age=60' },
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
    name: str('name'), price: str('price'), area: str('area'),
    acreage: str('acreage'), status: str('status'),
    image: str('image'), images: arr('images'),
    lat: num('lat'),    lng: num('lng'),
  };
}

function escHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
