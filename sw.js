const CACHE_NAME = 'genalsat-shell-v10';
const APP_SHELL = [
  './',
  './index.html',
  './styles.css',
  './db.js',
  './app.js',
  './manifest.webmanifest',
  './icon.svg'
];

self.addEventListener('install', event=>{
  event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', event=>{
  event.waitUntil(
    caches.keys().then(keys=>Promise.all(
      keys.filter(key=>key !== CACHE_NAME).map(key=>caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event=>{
  if(event.request.method !== 'GET') return;
  if(event.request.url.startsWith('blob:') || event.request.url.startsWith('data:')) return;
  const requestUrl = new URL(event.request.url);
  if(requestUrl.origin === self.location.origin){
    const networkResponse = fetch(event.request);
    event.waitUntil(networkResponse.then(response=>{
      if(!response.ok) return;
      return caches.open(CACHE_NAME).then(cache=>cache.put(event.request, response.clone()));
    }).catch(error=>{
      console.warn('No se pudo actualizar la caché de la aplicación.', error);
    }));
    event.respondWith(networkResponse.catch(()=>caches.match(event.request)));
    return;
  }
  // Never cache third-party or authenticated responses. Drive media responses
  // are private and may differ between users for the same file URL.
  return;
});
