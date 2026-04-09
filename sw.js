// ======================================================================
// SERVICE WORKER — Chrono PWA
// ======================================================================
const CACHE_VERSION = 'chrono-v1';
const STATIC_ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
];

// ======================================================================
// INSTALL: Pre-cache static assets
// ======================================================================
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// ======================================================================
// ACTIVATE: Purge stale caches
// ======================================================================
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(k => k.startsWith('chrono-') && k !== CACHE_VERSION)
          .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ======================================================================
// FETCH: Cache-first strategy + dynamic icon generation
// ======================================================================
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Intercept icon requests and generate them on-the-fly
  if (url.pathname.endsWith('icon-192.png')) {
    event.respondWith(serveIcon(192));
    return;
  }
  if (url.pathname.endsWith('icon-512.png')) {
    event.respondWith(serveIcon(512));
    return;
  }

  // Cache-first for everything else
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        // Only cache same-origin successful responses
        if (response.ok && url.origin === self.location.origin) {
          const clone = response.clone();
          caches.open(CACHE_VERSION).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // Offline fallback: return the cached index for navigation requests
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});

// ======================================================================
// ICON GENERATION via OffscreenCanvas (iOS Safari 16.4+)
// Falls back to inline SVG for older clients.
// ======================================================================
async function serveIcon(size) {
  // Check cache first
  const cache = await caches.open(CACHE_VERSION);
  const cached = await cache.match(`./icon-${size}.png`);
  if (cached) return cached;

  let response;
  if (typeof OffscreenCanvas !== 'undefined') {
    try {
      const blob = await renderStopwatchIcon(size);
      response = new Response(blob, {
        headers: {
          'Content-Type': 'image/png',
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      });
    } catch (err) {
      console.warn('[SW] OffscreenCanvas icon failed:', err);
      response = svgIconResponse(size);
    }
  } else {
    response = svgIconResponse(size);
  }

  // Store for next time
  cache.put(`./icon-${size}.png`, response.clone());
  return response;
}

async function renderStopwatchIcon(size) {
  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // ---- Background ----
  ctx.fillStyle = '#050508';
  ctx.fillRect(0, 0, size, size);

  const cx = size * 0.50;
  const cy = size * 0.54;
  const r  = size * 0.31;
  const cyan = '#00ccff';

  ctx.lineCap = 'round';

  // Helper: draw with glow (bloom pass then sharp pass)
  function neonStroke(drawFn, lineWidth) {
    ctx.save();
    ctx.shadowColor = cyan;
    ctx.shadowBlur  = size * 0.07;
    ctx.strokeStyle = `rgba(0,200,255,0.35)`;
    ctx.lineWidth   = lineWidth * 2.2;
    drawFn();
    ctx.stroke();

    ctx.shadowBlur  = size * 0.04;
    ctx.strokeStyle = cyan;
    ctx.lineWidth   = lineWidth;
    drawFn();
    ctx.stroke();
    ctx.restore();
  }

  // ---- Outer circle ----
  neonStroke(() => {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
  }, size * 0.042);

  // ---- Crown (top button) ----
  const crownW = size * 0.12;
  const crownH = size * 0.085;
  neonStroke(() => {
    ctx.beginPath();
    ctx.moveTo(cx - crownW / 2, cy - r + 1);
    ctx.lineTo(cx - crownW / 2, cy - r - crownH);
    ctx.lineTo(cx + crownW / 2, cy - r - crownH);
    ctx.lineTo(cx + crownW / 2, cy - r + 1);
  }, size * 0.038);

  // ---- Side lap button ----
  neonStroke(() => {
    ctx.beginPath();
    ctx.moveTo(cx + r - 1,         cy - r * 0.22);
    ctx.lineTo(cx + r + size * 0.065, cy - r * 0.22);
  }, size * 0.035);

  // ---- Hour hand ----
  neonStroke(() => {
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx, cy - r * 0.62);
  }, size * 0.032);

  // ---- Minute hand ----
  neonStroke(() => {
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + r * 0.44, cy + r * 0.18);
  }, size * 0.026);

  // ---- Center dot ----
  ctx.save();
  ctx.shadowColor = cyan;
  ctx.shadowBlur  = size * 0.05;
  ctx.fillStyle   = cyan;
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.028, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  return canvas.convertToBlob({ type: 'image/png' });
}

function svgIconResponse(size) {
  const s = size;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 100 100">
  <rect width="100" height="100" fill="#050508"/>
  <filter id="glow"><feGaussianBlur stdDeviation="1.8" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  <g filter="url(#glow)" stroke="#00ccff" fill="none" stroke-linecap="round">
    <circle cx="50" cy="54" r="30" stroke-width="4.2"/>
    <polyline points="44,24 44,16 56,16 56,24" stroke-width="3.8"/>
    <line x1="79" y1="47" x2="86" y2="47" stroke-width="3.5"/>
    <line x1="50" y1="54" x2="50" y2="29" stroke-width="3.2"/>
    <line x1="50" y1="54" x2="63" y2="59" stroke-width="2.6"/>
    <circle cx="50" cy="54" r="2.8" fill="#00ccff" stroke="none"/>
  </g>
</svg>`;

  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
