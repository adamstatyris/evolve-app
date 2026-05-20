/* Service worker: fetch pass-through + Web Push only.
 * Scheduled reminders are delivered via Supabase Edge (push) — no Periodic Background Sync snapshot.
 */
var CONSISTENCY_SW_CACHE = 'consistency-sw-v9';

function notifIconUrl() {
  try {
    return new URL('icons/icon-192.png?v=3', self.registration.scope || self.location).href;
  } catch (e) {
    return undefined;
  }
}

self.addEventListener('install', function (e) {
  self.skipWaiting();
});

self.addEventListener('activate', function (e) {
  e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', function (e) {
  if (e.request.mode === 'navigate' || e.request.destination === 'document') {
    return;
  }
  try {
    var reqUrl = new URL(e.request.url);
    var swUrl = new URL(self.location.href);
    if (reqUrl.origin !== swUrl.origin) {
      return;
    }
  } catch (err) {
    return;
  }
  e.respondWith(
    fetch(e.request).catch(function () {
      return Response.error();
    })
  );
});

self.addEventListener('push', function (event) {
  var title = 'Consistency';
  var body = '';
  var tag = 'consistency-push';
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
