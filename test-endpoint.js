// Test server western endpoint paths
const http = require('http');

// ★ 一个 320x320 的 1x1 红 png (超短 base64) 用来测 400 invalid-image
const shortPng = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkAAIAAAoAAv/lxKUAAAAASUVORK5CYII=';

// ★ 480x480 的有效 jpg (用 server 端 _debug 里的 sample)
const fs = require('fs');
const path = require('path');
const debugDir = path.join(__dirname, '_debug');
let validJpg = null;
try {
  // 优先用 modern 之前存的 frame（如果有）
  const p = path.join(debugDir, 'modern_last_received_frame.jpg');
  if (fs.existsSync(p)) {
    validJpg = 'data:image/jpeg;base64,' + fs.readFileSync(p).toString('base64');
    console.log('using modern_last_received_frame.jpg · bytes:', fs.statSync(p).size);
  } else {
    // fallback: 生成一个最小 320x240 jpeg
    validJpg = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/8A//2Q==';
  }
} catch (e) {
  console.warn('fallback jpg err:', e.message);
}

function postJSON(pathname, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = JSON.stringify(body);
    const req = http.request({
      hostname: 'localhost',
      port: 8000,
      path: pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr)
      }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}

(async () => {
  // 1) 无 image → 400
  let r = await postJSON('/api/classify/western', { allowedSampleIds: ['W01'] });
  console.log('1) empty body →', r.status, r.body.slice(0, 200));

  // 2) 短 base64 → 400
  r = await postJSON('/api/classify/western', { image: 'data:image/jpeg;base64,' + shortPng, allowedSampleIds: ['W01'] });
  console.log('2) short base64 →', r.status, r.body.slice(0, 200));

  // 3) localFaceDetected=false → 422
  r = await postJSON('/api/classify/western', { image: validJpg, localFaceDetected: false, localLandmarkCount: 0, allowedSampleIds: ['W01'] });
  console.log('3) no face →', r.status, r.body.slice(0, 200));

  // 4) localFaceDetected=true 但有 short edge → 400 (如果图 < 256 短边)
  // 5) 完整：localFaceDetected=true + 有 crop → 真调 upstream
  r = await postJSON('/api/classify/western', {
    image: validJpg,
    faceCropDataUrl: validJpg,
    localFaceDetected: true,
    localLandmarkCount: 478,
    allowedSampleIds: ['W01','W02','W03','W04','W05','W06','W07','W08','W09','W10','W11','W12','W13','W14']
  });
  console.log('4) full request →', r.status, r.body.slice(0, 500));
})();
