/* Service worker: Web Push only (no asset caching).
 * Do NOT intercept fetch — pass-through avoids Response.error() breaking PWA loads on flaky mobile networks.
 */
var EVOLVE_SW_CACHE = 'evolve-sw-v68';

var _brandIconBlobUrl = null;
var _emojiIconCache = Object.create(null);

function scopeUrl(rel) {
  try {
    return new URL(rel, self.registration.scope || self.location).href;
  } catch (e) {
    return rel;
  }
}

function roundedRectPath(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function canvasToBlobUrl(canvas) {
  return new Promise(function (resolve, reject) {
    if (canvas.convertToBlob) {
      canvas.convertToBlob({ type: 'image/png' }).then(function (blob) {
        resolve(URL.createObjectURL(blob));
      }, reject);
      return;
    }
    canvas.toBlob(function (blob) {
      if (blob) resolve(URL.createObjectURL(blob));
      else reject(new Error('toBlob failed'));
    }, 'image/png');
  });
}

function rasterizeImageToIconUrl(src, size) {
  size = size || 192;
  return new Promise(function (resolve, reject) {
    var img = new Image();
    img.onload = function () {
      try {
        var canvas = new OffscreenCanvas(size, size);
        var ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, size, size);
        roundedRectPath(ctx, 8, 8, size - 16, size - 16, 24);
        ctx.save();
        ctx.clip();
        var scale = Math.min((size - 16) / img.width, (size - 16) / img.height);
        var dw = img.width * scale;
        var dh = img.height * scale;
        ctx.drawImage(img, (size - dw) / 2, (size - dh) / 2, dw, dh);
        ctx.restore();
        canvasToBlobUrl(canvas).then(resolve, reject);
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = reject;
    img.src = src;
  });
}

function brandIconUrl() {
  if (_brandIconBlobUrl) return Promise.resolve(_brandIconBlobUrl);
  var candidates = [
    'icons/Evolve Logomark Bright.svg',
    'icons/evolve-logomark.svg',
    'icons/icon-192.png',
  ];
  var chain = Promise.reject();
  candidates.forEach(function (path) {
    chain = chain.catch(function () {
      return rasterizeImageToIconUrl(scopeUrl(path));
    });
  });
  return chain.then(function (url) {
    _brandIconBlobUrl = url;
    return url;
  });
}

function emojiIconUrl(rawEmoji) {
  var emoji = String(rawEmoji || '').trim();
  if (!emoji) return brandIconUrl();
  if (_emojiIconCache[emoji]) return Promise.resolve(_emojiIconCache[emoji]);
  var size = 192;
  var glyphs = Array.from(emoji);
  var multi = glyphs.length > 1;
  var canvas = new OffscreenCanvas(size, size);
  var ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);
  roundedRectPath(ctx, 20, 20, size - 40, size - 40, 28);
  ctx.fillStyle = '#2a3441';
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (multi) {
    ctx.font = '600 52px system-ui, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
    var gap = 4;
    var totalW = 0;
    glyphs.forEach(function (g) {
      totalW += ctx.measureText(g).width + gap;
    });
    totalW -= gap;
    var x = (size - totalW) / 2;
    glyphs.forEach(function (g) {
      var w = ctx.measureText(g).width;
      ctx.fillText(g, x + w / 2, size / 2 + 2);
      x += w + gap;
    });
  } else {
    ctx.font = '600 96px system-ui, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
    ctx.fillText(emoji, size / 2, size / 2 + 4);
  }
  return canvasToBlobUrl(canvas).then(function (url) {
    _emojiIconCache[emoji] = url;
    return url;
  });
}

function resolveNotificationIcon(iconEmoji) {
  var emoji = String(iconEmoji || '').trim();
  if (emoji) return emojiIconUrl(emoji);
  return brandIconUrl();
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
  var iconEmoji = '';
  if (event.data) {
    try {
      var j = event.data.json();
      if (j.title) title = j.title;
      if (j.body != null) body = j.body;
      if (j.tag) tag = j.tag;
      if (j.iconEmoji != null) iconEmoji = j.iconEmoji;
    } catch (e) {
      try {
        body = event.data.text() || '';
      } catch (e2) {}
    }
  }
  event.waitUntil(
    resolveNotificationIcon(iconEmoji).then(function (icon) {
      return self.registration.showNotification(title, { body: body, tag: tag, icon: icon });
    }).catch(function () {
      return self.registration.showNotification(title, { body: body, tag: tag });
    })
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
