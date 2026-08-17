// Service worker: cache app-shell để mở được khi mất mạng.
// Đổi CACHE_NAME (vd v2, v3...) mỗi khi muốn ép trình duyệt nạp bản mới.
const CACHE_NAME = 'aicert-cache-v2';
const APP_SHELL = [
  './ai-cert-quiz.html',
  './data.json',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  // Chỉ can thiệp GET cùng gốc — bỏ qua API dịch (translate.googleapis.com) và các domain khác
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  // Trang HTML chính: ưu tiên mạng để luôn có bản mới nhất, offline thì dùng cache
  if (req.mode === 'navigate' || req.destination === 'document') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((res) => res || caches.match('./ai-cert-quiz.html')))
    );
    return;
  }

  // Tài nguyên tĩnh khác (icon, manifest): ưu tiên cache, không có thì mới gọi mạng
  event.respondWith(
    caches.match(req).then((cached) => cached || fetch(req))
  );
});
