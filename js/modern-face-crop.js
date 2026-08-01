/* modern-face-crop.js
 * createFaceCropFromSnapshot(dataUrl, landmarks, frameW, frameH)
 *  - 从同一锁定帧中按 landmarks bbox + 35% padding 裁出方形人脸图
 *  - 最大边 512 · JPEG quality 0.7（减小 base64 体积，加快 upstream 请求）
 *  - 返回 JPEG dataURL
 */
(function () {
  // ★ 优化：最大边 512 · JPEG 0.7（避免 60000ms 超时）
  var MAX_EDGE = 512;
  var JPEG_QUALITY = 0.7;
  function createFaceCropFromSnapshot(imageDataUrl, landmarks, frameW, frameH) {
    return new Promise(function (resolve) {
      if (!imageDataUrl || !Array.isArray(landmarks) || landmarks.length < 10) {
        resolve(null);
        return;
      }
      var img = new Image();
      img.onload = function () {
        try {
          var xs = [], ys = [];
          for (var i = 0; i < landmarks.length; i++) {
            var p = landmarks[i];
            var px = p && (p.x != null ? p.x : (p.x !== undefined ? p.x : null));
            var py = p && (p.y != null ? p.y : (p.y !== undefined ? p.y : null));
            if (px == null || py == null) continue;
            if (px > 1.5) {
              xs.push(px); ys.push(py);
            } else {
              xs.push(px * img.width);
              ys.push(py * img.height);
            }
          }
          if (xs.length < 4) { resolve(null); return; }
          var minX = Math.max(0, Math.min.apply(null, xs));
          var maxX = Math.min(img.width, Math.max.apply(null, xs));
          var minY = Math.max(0, Math.min.apply(null, ys));
          var maxY = Math.min(img.height, Math.max.apply(null, ys));
          var w = maxX - minX, h = maxY - minY;
          if (w < 1 || h < 1) { resolve(null); return; }
          var padX = w * 0.35, padY = h * 0.35;
          var cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
          var half = Math.max(w + padX * 2, h + padY * 2) / 2;
          var sqMinX = Math.max(0, Math.round(cx - half));
          var sqMinY = Math.max(0, Math.round(cy - half));
          var sqMaxX = Math.min(img.width, Math.round(cx + half));
          var sqMaxY = Math.min(img.height, Math.round(cy + half));
          var sqW = sqMaxX - sqMinX, sqH = sqMaxY - sqMinY;
          if (sqW < 32 || sqH < 32) { resolve(null); return; }
          // ★ 裁剪后缩放至最大边 512（保持正方形）
          var scale = 1;
          var longest = Math.max(sqW, sqH);
          if (longest > MAX_EDGE) scale = MAX_EDGE / longest;
          var outW = Math.max(320, Math.round(sqW * scale));
          var outH = Math.max(320, Math.round(sqH * scale));
          var canvas = document.createElement('canvas');
          canvas.width = outW; canvas.height = outH;
          var ctx = canvas.getContext('2d');
          ctx.fillStyle = '#000';
          ctx.fillRect(0, 0, outW, outH);
          ctx.drawImage(img, sqMinX, sqMinY, sqW, sqH, 0, 0, outW, outH);
          var dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
          console.log('[MODERN_FACE_CROP] client · src=' + sqW + 'x' + sqH + ' · out=' + outW + 'x' + outH + ' · q=' + JPEG_QUALITY + ' · landmarks=' + xs.length);
          resolve(dataUrl);
        } catch (e) {
          console.error('[MODERN_FACE_CROP] client err:', e.message);
          resolve(null);
        }
      };
      img.onerror = function () { resolve(null); };
      img.src = imageDataUrl;
    });
  }
  window.createFaceCropFromSnapshot = createFaceCropFromSnapshot;
})();