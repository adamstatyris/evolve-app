/* Service worker: Web Push only (no asset caching).
 * Do NOT intercept fetch — pass-through avoids Response.error() breaking PWA loads on flaky mobile networks.
 */
var EVOLVE_SW_CACHE = 'evolve-sw-v27';

function notifIconUrl() {
  try {
    return new URL('icons/icon-192.png?v=5', self.registration.scope || self.location).href;
  } catch (e) {
    return undefined;
  }
}

self.addEventListener('install', function (e) {
  self.skipWaiting();
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.map(function (k) {
          if ((k.indexOf('evolve-sw-') === 0 || k.indexOf('consistency-sw-') === 0) && k !== EVOLVE_SW_CACHE) {
            return caches.delete(k);
          }
        })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener('push', function (event) {
  var title = 'Evolve';
  var body = '';
  var tag = 'evolve-push';
  var icon = notifIconUrl();
  if (event.data) {
    try {
      var j = event.data.json();
      if (j.title) title = j.title;
      if (j.body != null) body = j.body;
      if (j.tag) tag = j.tag;
    } catch (e) {
      try {
        body = event.data.text() || '';
      } catch (e2) {}
    }
  }
  event.waitUntil(
    self.registration.showNotification(title, { body: body, tag: tag, icon: icon, badge: icon })
  );
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
      for (var i = 0; i < list.length; i++) {
        var c = list[i];
        if (c.url && 'focus' in c) return c.focus();
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(new URL('./', self.location).href);
      }
    })
  );
});
