// Try to load api/index.js and print error location
try {
  const m = require('D:/TRAE SOLO CN/程序艺术作业/exhibition-camera/api/index.js');
  console.log('LOADED OK · type:', typeof m);
} catch (e) {
  console.log('=== ERR ===');
  console.log('message:', e.message);
  console.log('stack:', e.stack);
}
