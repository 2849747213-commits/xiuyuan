/* modern-face-crop.js
 * createFaceCropFromSnapshot(dataUrl, landmarks, frameW, frameH)
 *  - 从同一锁定帧中按 landmarks bbox + 35% padding 裁出方形人脸图（最小 320×320）
 *  - 返回 JPEG dataURL（quality 0.9）
 */
(function () {
  function createFaceCropFromSnapshot(imageDataUrl, landmarks, frameW, frameH) {
    return new Promise(function (resolve) {
      if (!imageDataUrl || !Array.isArray(landmarks) || landmarks.length < 10) {
        resolve(null);
        return;
      }
      var img = new Image();
      img.onload = function () {
        try {
          // landmarks 通常为 [{x, y, z}] 形式（normalized 0..1 相对图像），也可能绝对像素
          var xs = [], ys = [];
          for (var i = 0; i < landmarks.length; i++) {
            var p = landmarks[i];
            var px = p && (p.x != null ? p.x : (p.x !== undefined ? p.x : null));
            var py = p && (p.y != null ? p.y : (p.y !== undefined ? p.y : null));
            if (px == null || py == null) continue;
            if (px > 1.5) { /* 绝对像素 */
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
          // ★ 35% padding · 转正方形
          var padX = w * 0.35, padY = h * 0.35;
          var cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
          var half = Math.max(w + padX * 2, h + padY * 2) / 2;
          var sqMinX = Math.max(0, Math.round(cx - half));
          var sqMinY = Math.max(0, Math.round(cy - half));
          var sqMaxX = Math.min(img.width, Math.round(cx + half));
          var sqMaxY = Math.min(img.height, Math.round(cy + half));
          var sqW = sqMaxX - sqMinX, sqH = sqMaxY - sqMinY;
          if (sqW < 32 || sqH < 32) { resolve(null); return; }
          var outW = Math.max(320, sqW);
          var outH = Math.max(320, sqH);
          var canvas = document.createElement('canvas');
          canvas.width = outW; canvas.height = outH;
          var ctx = canvas.getContext('2d');
          ctx.fillStyle = '#000';
          ctx.fillRect(0, 0, outW, outH);
          ctx.drawImage(img, sqMinX, sqMinY, sqW, sqH, 0, 0, outW, outH);
          var dataUrl = canvas.toDataURL('image/jpeg', 0.9);
          console.log('[MODERN_FACE_CROP] client · src=' + sqW + 'x' + sqH + ' · out=' + outW + 'x' + outH + ' · landmarks=' + xs.length);
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