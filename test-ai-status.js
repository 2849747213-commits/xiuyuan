// 测真 AI upstream 状态：发完整请求看是否还 429
const http = require('http');
const fs = require('fs');
const path = require('path');

let validJpg = null;
try {
  const p = path.join(__dirname, '_debug', 'western_last_received_frame.jpg');
  if (fs.existsSync(p)) {
    validJpg = 'data:image/jpeg;base64,' + fs.readFileSync(p).toString('base64');
  }
} catch (e) {}
if (!validJpg) {
  // fallback: 生成一个 480x360 valid jpg base64
  validJpg = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDAREAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AVoH/2Q==';
}

function post(pathname, body) {
  return new Promise((resolve, reject) => {
    const s = JSON.stringify(body);
    const req = http.request({ hostname: 'localhost', port: 8000, path: pathname, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(s) }
    }, res => { let d=''; res.on('data', c => d+=c); res.on('end', () => resolve({ status: res.statusCode, body: d })); });
    req.on('error', reject);
    req.write(s); req.end();
  });
}

(async () => {
  // ★ 完整请求：localFaceDetected=true + 有 image + 有 crop
  const r = await post('/api/classify/western', {
    image: validJpg, faceCropDataUrl: validJpg,
    localFaceDetected: true, localLandmarkCount: 478,
    allowedSampleIds: ['W01','W02','W03','W04','W05','W06','W07','W08','W09','W10','W11','W12','W13','W14']
  });
  console.log('HTTP', r.status, '·', r.body.slice(0, 600));
})();
