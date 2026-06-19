/* Service worker: Web Push only (no asset caching).
 * Do NOT intercept fetch — pass-through avoids Response.error() breaking PWA loads on flaky mobile networks.
 */
var EVOLVE_SW_CACHE = 'evolve-sw-v81';

var _brandIconDataUrl = null;
var _emojiIconCache = Object.create(null);

function scopeUrl(rel) {
  try {
    return new URL(rel, self.registration.scope || self.location).href;
  } catch (e) {
    return rel;
  }
}

function brandBadgeUrl() {
  return scopeUrl('icons/icon-192.png?v=5');
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

function blobToDataUrl(blob) {
  return new Promise(function (resolve, reject) {
    var reader = new FileReader();
    reader.onload = function () {
      resolve(reader.result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function canvasToDataUrl(canvas) {
  if (canvas.convertToBlob) {
    return canvas.convertToBlob({ type: 'image/png' }).then(blobToDataUrl);
  }
  if (canvas.toDataURL) {
    return Promise.resolve(canvas.toDataURL('image/png'));
  }
  return Promise.reject(new Error('canvas export unavailable'));
}

function rasterizeImageToDataUrl(src, size) {
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
        canvasToDataUrl(canvas).then(resolve, reject);
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = reject;
    img.src = src;
  });
}

function brandIconDataUrl() {
  if (_brandIconDataUrl) return Promise.resolve(_brandIconDataUrl);
  var candidates = [
    'icons/Evolve Logomark Bright.svg',
    'icons/evolve-logomark.svg',
    'icons/icon-192.png?v=5',
  ];
  var chain = Promise.reject();
  candidates.forEach(function (path) {
    chain = chain.catch(function () {
      return rasterizeImageToDataUrl(scopeUrl(path));
    });
  });
  return chain.then(function (url) {
    _brandIconDataUrl = url;
    return url;
  });
}

function emojiFromGeneralReminderTag(tag) {
  var t = String(tag || '').trim();
  if (t === 'habits_day') return '✅';
  if (t === 'habits_morning') return '☀️';
  if (t.indexOf('sun_') === 0) return '🗓️';
  if (t === '_tempPushTest') return '🔔';
  return '';
}

function emojiFromReminderTag(tag) {
  var t = String(tag || '');
  if (t.indexOf('hrd:') !== 0) return '';
  var rest = t.slice(4);
  if (rest.indexOf('|') >= 0) {
    var parts = rest.split('|');
    if (parts.length >= 3) return String(parts.slice(2).join('|')).trim();
  }
  return '';
}

function emojiIconUrl(rawEmoji) {
  var emoji = String(rawEmoji || '').trim();
  if (!emoji) return Promise.resolve('');
  if (_emojiIconCache[emoji]) return Promise.resolve(_emojiIconCache[emoji]);
  var size = 192;
  var glyphs = Array.from(emoji);
  var multi = glyphs.length > 1;
  var canvas = new OffscreenCanvas(size, size);
  var ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);
  roundedRectPath(ctx, 20, 20, size - 40, size - 40, 28);
  ctx.fillStyle = '#eef3f8';
  ctx.fill();
  ctx.fillStyle = '#1a2332';
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
  return canvasToDataUrl(canvas).then(function (url) {
    _emojiIconCache[emoji] = url;
    return url;
  });
}

function resolveNotificationIcons(iconEmoji, tag) {
  var emoji = String(iconEmoji || '').trim();
  if (!emoji) emoji = emojiFromReminderTag(tag);
  if (!emoji) emoji = emojiFromGeneralReminderTag(tag);
  var badge = brandBadgeUrl();
  if (!emoji) {
    return brandIconDataUrl().then(function (brand) {
      return { badge: badge, icon: brand || badge };
    }).catch(function () {
      return { badge: badge, icon: badge };
    });
  }
  return emojiIconUrl(emoji).then(function (habitIcon) {
    return { badge: badge, icon: habitIcon || badge };
  }).catch(function () {
    return brandIconDataUrl().then(function (brand) {
      return { badge: badge, icon: brand || badge };
    }).catch(function () {
      return { badge: badge, icon: badge };
    });
  });
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
    resolveNotificationIcons(iconEmoji, tag).then(function (icons) {
      return self.registration.showNotification(title, {
        body: body,
        tag: tag,
        badge: icons.badge,
        icon: icons.icon,
      });
    }).catch(function () {
      var fallback = brandBadgeUrl();
      return self.registration.showNotification(title, { body: body, tag: tag, badge: fallback, icon: fallback });
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
