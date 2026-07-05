/* Service worker: Web Push only (no asset caching).
 * Do NOT intercept fetch — pass-through avoids Response.error() breaking PWA loads on flaky mobile networks.
 */
var EVOLVE_SW_CACHE = 'evolve-sw-v89';

var _brandColorIconDataUrl = null;
var _brandMonoBadgeDataUrl = null;
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

function fetchAssetAsDataUrl(rel) {
  return fetch(scopeUrl(rel)).then(function (res) {
    if (!res.ok) throw new Error('asset fetch failed: ' + rel);
    return res.blob();
  }).then(blobToDataUrl);
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

function colorIconToMonochromeBadgeDataUrl(colorDataUrl) {
  return new Promise(function (resolve, reject) {
    var img = new Image();
    img.onload = function () {
      try {
        var size = 96;
        var canvas = new OffscreenCanvas(size, size);
        var ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, size, size);
        ctx.drawImage(img, 0, 0, size, size);
        var id = ctx.getImageData(0, 0, size, size);
        var d = id.data;
        for (var i = 0; i < d.length; i += 4) {
          var a = d[i + 3];
          if (a < 12) {
            d[i + 3] = 0;
            continue;
          }
          d[i] = 255;
          d[i + 1] = 255;
          d[i + 2] = 255;
          d[i + 3] = Math.min(255, Math.round(a * 0.95));
        }
        ctx.putImageData(id, 0, 0);
        canvasToDataUrl(canvas).then(resolve, reject);
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = reject;
    img.src = colorDataUrl;
  });
}

function brandColorIconDataUrl() {
  if (_brandColorIconDataUrl) return Promise.resolve(_brandColorIconDataUrl);
  var chain = fetchAssetAsDataUrl('icons/icon-192.png').catch(function () {
    return fetchAssetAsDataUrl('icons/apple-touch-icon.png');
  }).catch(function () {
    return rasterizeImageToDataUrl(scopeUrl('icons/evolve-logomark.svg'));
  });
  return chain.then(function (url) {
    _brandColorIconDataUrl = url;
    return url;
  });
}

function brandMonochromeBadgeDataUrl() {
  if (_brandMonoBadgeDataUrl) return Promise.resolve(_brandMonoBadgeDataUrl);
  return brandColorIconDataUrl().then(colorIconToMonochromeBadgeDataUrl).then(function (url) {
    _brandMonoBadgeDataUrl = url;
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

function emojiIconUrl(rawEmoji, tagOpt) {
  var emoji = String(rawEmoji || '').trim();
  var tag = String(tagOpt || '').trim();
  if (!emoji) return Promise.resolve('');
  var cacheKey = emoji + '|' + tag;
  if (_emojiIconCache[cacheKey]) return Promise.resolve(_emojiIconCache[cacheKey]);
  var size = 192;
  var glyphs = Array.from(emoji);
  var multi = glyphs.length > 1;
  var isMorning = tag === 'habits_morning' || emoji === '☀️';
  var canvas = new OffscreenCanvas(size, size);
  var ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);
  roundedRectPath(ctx, 20, 20, size - 40, size - 40, 28);
  if (isMorning) {
    var grd = ctx.createLinearGradient(20, 20, size - 20, size - 20);
    grd.addColorStop(0, '#ffe566');
    grd.addColorStop(1, '#ffb703');
    ctx.fillStyle = grd;
  } else {
    ctx.fillStyle = '#f4f7fb';
  }
  ctx.fill();
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
    ctx.font = '600 ' + (isMorning ? '112' : '96') + 'px system-ui, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
    ctx.fillText(emoji, size / 2, size / 2 + 4);
  }
  return canvasToDataUrl(canvas).then(function (url) {
    _emojiIconCache[cacheKey] = url;
    return url;
  });
}

function resolveNotificationIcons(iconEmoji, tag) {
  var tagStr = String(tag || '');
  var emoji = String(iconEmoji || '').trim();
  if (!emoji) emoji = emojiFromReminderTag(tagStr);
  var isHabitTag = tagStr.indexOf('hrd:') === 0;
  var badgeChain = brandMonochromeBadgeDataUrl();
  return badgeChain.then(function (badge) {
    if (isHabitTag && emoji) {
      return emojiIconUrl(emoji, tagStr).then(function (habitIcon) {
        return { badge: badge, icon: habitIcon || null };
      }).catch(function () {
        return { badge: badge, icon: null };
      });
    }
    return { badge: badge, icon: null };
  }).catch(function () {
    return brandColorIconDataUrl().then(function (fallback) {
      return { badge: fallback, icon: null };
    });
  });
}

function showPushNotification(title, body, tag, icons) {
  var opts = {
    body: body,
    tag: tag,
    badge: icons.badge,
    data: { tag: tag },
  };
  if (icons.icon) opts.icon = icons.icon;
  return self.registration.showNotification(title, opts);
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
      return showPushNotification(title, body, tag, icons);
    }).catch(function () {
      return brandMonochromeBadgeDataUrl().then(function (badge) {
        return showPushNotification(title, body, tag, { badge: badge, icon: null });
      }).catch(function () {
        return self.registration.showNotification(title, { body: body, tag: tag });
      });
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
