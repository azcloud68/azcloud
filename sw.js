const CDN_PREFIX = '/gh/';
const JSDELIVR_PREFIX = 'https://cdn.jsdelivr.net/gh/';

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  if (url.pathname.startsWith(CDN_PREFIX)) {
    const cdnPath = url.pathname.replace(CDN_PREFIX, '');
    const jsDelivrURL = JSDELIVR_PREFIX + cdnPath;

    event.respondWith(fetch(jsDelivrURL));
  }
});
