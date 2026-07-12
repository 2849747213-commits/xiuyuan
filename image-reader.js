// ============================================
// 简化版 image-reader.js（全局函数版 · 不依赖 ES module）
// 挂到 window.ImageReader
// ============================================
(function(global) {
  'use strict';

  function fileToDataUrl(file) {
    return new Promise(function(resolve, reject) {
      const reader = new FileReader();
      reader.onload = function() { resolve(reader.result); };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function loadImage(dataUrl) {
    return new Promise(function(resolve, reject) {
      const img = new Image();
      img.onload = function() { resolve(img); };
      img.onerror = reject;
      img.src = dataUrl;
    });
  }

  function getDominantColors(img, sampleW, sampleH) {
    const c = document.createElement('canvas');
    c.width = sampleW; c.height = sampleH;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0, sampleW, sampleH);
    try {
      const data = ctx.getImageData(0, 0, sampleW, sampleH).data;
      const buckets = {};
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i] >> 4, g = data[i+1] >> 4, b = data[i+2] >> 4;
        const k = (r << 8) | (g << 4) | b;
        buckets[k] = (buckets[k] || 0) + 1;
      }
      const sorted = Object.entries(buckets)
        .sort(function(a, b) { return b[1] - a[1]; })
        .slice(0, 3)
        .map(function(entry) {
          const k = parseInt(entry[0], 10);
          return [((k >> 8) & 0xf) << 4, ((k >> 4) & 0xf) << 4, (k & 0xf) << 4];
        });
      return sorted;
    } catch (e) {
      return [[128, 128, 128]];
    }
  }

  function estimateFaceCount(img) {
    // 简化版：人脸检测需要 face-api 这种库，我们这里只做最简估算
    // 返回 0（避免引入第三方库）
    return 0;
  }

  function describeImage(meta) {
    const w = meta.width || 0;
    const h = meta.height || 0;
    const ratio = w / h;
    let orient = '正方形';
    if (ratio > 1.3) orient = '横向';
    else if (ratio < 0.77) orient = '竖向';
    const colors = (meta.dominantColors || []).map(function(c) {
      return 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')';
    }).join(' / ');
    return '图像 ' + w + '×' + h + '（' + orient + '）· 主色：' + colors;
  }

  function buildImageCaption(meta) {
    return describeImage(meta);
  }

  async function readImageFromDataUrl(dataUrl, fileName, fileSize) {
    try {
      const img = await loadImage(dataUrl);
      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;
      const aspect = h ? w / h : 0;
      const dominantColors = getDominantColors(img, 16, 16);
      const faceCount = estimateFaceCount(img);
      const caption = buildImageCaption({ width: w, height: h, dominantColors: dominantColors });
      return {
        width: w, height: h, aspect: aspect,
        faceCount: faceCount, dominantColors: dominantColors,
        caption: caption, fileName: fileName || 'untitled', fileSize: fileSize || 0
      };
    } catch (e) {
      console.warn('[image-reader] loadImage failed:', e);
      return {
        width: 0, height: 0, aspect: 0, faceCount: 0,
        dominantColors: [[128, 128, 128]], caption: '',
        fileName: fileName || 'untitled', fileSize: fileSize || 0
      };
    }
  }

  async function readImageFromFile(file) {
    const dataUrl = await fileToDataUrl(file);
    return await readImageFromDataUrl(dataUrl, file.name, file.size);
  }

  global.ImageReader = {
    readImageFromFile: readImageFromFile,
    readImageFromDataUrl: readImageFromDataUrl,
    buildImageCaption: buildImageCaption,
  };
  console.log('[image-reader] loaded as window.ImageReader');
})(typeof window !== 'undefined' ? window : this);
