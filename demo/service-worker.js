/* eslint-env browser */
'use strict';
const SW_PACK_PREFIX = 'sw-pack';
const SW_PACK_INTERNAL = '$$$sw-pack-internal';
const SW_PACK_PATH = 'sw-pack.json';

var SW_PACK = null;

// @exclude
SW_PACK = {
  hash: 'v1',
  cache: [
    { path: 'index.html', hash: '1aaa' },
    { path: 'demo.css', hash: '1bbb' },
    {
      path: 'https://cdnjs.cloudflare.com/ajax/libs/trianglify/0.4.0/trianglify.min.js',
      hash: '1ccc'
    },
  ],
  _swpackRevision: 1,
  archiveVersions: 1,
  archivedPacks: []
};
// @endexclude
// @echo SW_PACK_DEFINITION

const SW_CURRENT_CACHE = `${SW_PACK_PREFIX}-${SW_PACK.hash}`;

const isActive = () => {
  var reg = self.registration;
  return (reg.active && reg.active.state === 'activated');
};

const getUid = () => (SW_PACK.hash || 'dev').substr(0, 3);
const getLog = (s) => `[sw:${getUid()}] %c${s}`;

const log = function(s, ...rest) {
  var c = isActive() ? '#0071ff' : '#ff5300';
  console.log(getLog(s, c), `color: ${c};`, ...rest);
  console.trace();
};

const error = function(s, ...rest) {
  var c = isActive() ? '#c400ff' : '#ff0000';
  console.error(getLog(s, c), `color: ${c};`, ...rest);
};

const group = function(s, ...rest) {
  var c = isActive() ? '#0071ff' : '#ff5300';
  console.groupCollapsed(getLog(s, c), `color: ${c};`, ...rest);
};

log('hello, this is service-worker 🐋!');

// cache
self.addEventListener('install', (event) => {
  log('installing...');
  event.waitUntil(install());
});

function install() {
  if (self.SW_PACK === null) {
    log('no pack to cache. doing nothing...');
    return;
  }

  return getLastPack()
    .then((pack) => {
      if (!pack) return fetchNCache(SW_PACK.cache);
      return installNewVersion(pack).then(() => {
        SW_PACK.archivedPacks.push(pack.hash);
      });
    }).then(() => saveCurrentPack(SW_PACK));
}

function fetchNCache(files) {
  let urls = files.map(f => f.path);
  group('caching files');
  urls.forEach(url => log(url));
  console.groupEnd();

  return caches.open(SW_CURRENT_CACHE)
    .then(c => c.addAll(urls))
    .catch(error);
}

function installNewVersion(oldPack) {
  let currentPack = SW_PACK;
  log('installing new version');
  let work = currentPack.cache.map(f => checkFile(oldPack, f));
  return Promise.all(work);
}

function checkFile(oldPack, f) {
  let promise = null;
  if (oldPack.cache.find(o => o.hash === f.hash)){
    promise = getFromPack(oldPack.hash, f.path);
  } else {
    promise = getFromNetwork(f.path); // TODO: patch
  }

  promise.then(res => {
    return caches.open(SW_CURRENT_CACHE).then(c => c.put(res.url, res));
  });
}

function getFromPack(packHash, path) {
  return caches.open(`${SW_PACK_PREFIX}-${packHash}`)
    .then(c => c.match(path));
}

function getFromNetwork(url) {
  return fetch(url);
}

function getLastPack() {
  return caches.open(SW_PACK_INTERNAL).then(c => {
    return c.match(SW_PACK_PATH).then((res) => {
      log(res);
      if (res) return res.json();
      else return null;
    });
  })
}

function saveCurrentPack(pack) {
  return caches.open(SW_PACK_INTERNAL).then(c => {
    var res = new Response(new Blob([JSON.stringify(pack)]));
    return Promise.all([
      c.put(SW_PACK_PATH, res.clone()),
      c.put(`${pack.hash}-${SW_PACK_PATH}`, res.clone())
    ]);
  });
}

function tryCache(event) {
  return event.respondWith(
    caches.open(SW_CURRENT_CACHE)
      .then((c) => c.match(event.request))
      .then(res => res || fetch(event.request)) // fallback
      .catch(error)
  );
}

self.addEventListener('fetch', (event) => {
  var url = event.request.url;

  //if (self.SW_PACK_CACHE !== true) return; // no cache for dev
  if (url === self.location.origin || /\/[a-zA-z0-9]*\/?$/.test(url)) {
    return event.respondWith(
      caches.open(SW_CURRENT_CACHE)
        .then((c) => c.match('index.html'))
        .then(res => {
          if (!res) {
            error('index.html is not cached!');
            return fetch('index.html');
          } else {
            return res;
          }
        })
        .catch(error)
    );
  }

  // for fun and debugging – respond to /sw-pack.json
  if (url === self.location.origin + '/' + SW_PACK_PATH) {
    return event.respondWith(
      caches.open(SW_PACK_INTERNAL).then(c => c.match(event.request))
    );
  }

  // local domain
  if (url.startsWith(self.location.origin)) return tryCache(event);

  // external cache domain
  if (SW_PACK.cache.find(c => c.path === url)) return tryCache(event);

  // ... no cache hit
});

self.addEventListener('activate', (event) => {
  log('activating');
  SW_PACK.archivedPacks = SW_PACK.archivedPacks.slice(0, SW_PACK.archiveVersions);

  // cleanup
  var cacheCleanup = caches.keys().then((keys) => {
    return Promise.all(keys.map(key => {
      // keep current cache and internal cache
      if (key === SW_PACK_INTERNAL ||  key === SW_CURRENT_CACHE) return;
      // keep archived versions
      if (SW_PACK.archiveVersions) {
        let found = SW_PACK.archivedPacks.find(k => {
          return `${SW_PACK_PREFIX}-${k}` === key;
        });
        if (found) return;
      }
      // you are outdated
      return caches.delete(key);
    }));
  });

  var internalCleanup = caches.open(SW_PACK_INTERNAL).then(c => {
    return c.keys().then(keys => {
      return Promise.all(keys.map(key => {
        var url = key.url.substr(self.location.origin.length + 1);

        if (url === SW_PACK_PATH) return;
        if (url === `${SW_PACK.hash}-${SW_PACK_PATH}`) return;
        if (SW_PACK.archiveVersions) {
          let found = SW_PACK.archivedPacks.find(h => {
            return `${h}-${SW_PACK_PATH}` === url;
          });
          if (found) return;
        }
        return c.delete(key);
      }));
    });
  });

  event.waitUntil(Promise.all([cacheCleanup, internalCleanup]));
});
