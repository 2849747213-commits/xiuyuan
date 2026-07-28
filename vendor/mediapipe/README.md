# MediaPipe Local Vendor

把 FaceLandmarker 用的 JS / WASM / .task 模型本地化，避免每次启动等 unpkg/jsdelivr/googleapis。

## 一次性下载

```bash
cd "d:\TRAE SOLO CN\程序艺术作业\exhibition-camera"
node tools/fetch-mediapipe-vendor.js
```

下载完成后目录结构：

```
vendor/mediapipe/
├── vision_bundle.mjs
├── vision_bundle.mjs.map
├── face_landmarker.task
└── wasm/
    ├── vision_wasm_internal.js
    ├── vision_wasm_internal.wasm
    ├── vision_wasm_nosimd_internal.js
    ├── vision_wasm_nosimd_internal.wasm
    ├── vision_wasm_simd_internal.js
    └── vision_wasm_simd_internal.wasm
```

## 加载顺序

`exhibition.js` 启动时按以下顺序加载：

1. `/vendor/mediapipe/vision_bundle.mjs`（本地）
2. `https://unpkg.com/@mediapipe/tasks-vision@0.10.18/vision_bundle.mjs`（CDN fallback）
3. `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/vision_bundle.mjs`（CDN fallback）

任一成功即可。WASM 用 `FilesetResolver.forVisionTasks('/vendor/mediapipe/wasm')` 走本地。

## 离线使用

下载完成后，**断网也能跑**（除了 `/api/classify/*` 仍需联网调 AI）。

## 文件大小参考

| 文件 | 大小 |
|------|------|
| `face_landmarker.task` | ~3.5 MB |
| `vision_wasm_simd_internal.wasm` | ~3 MB |
| `vision_bundle.mjs` | ~150 KB |
| 其他 wasm | 各 ~3 MB |

总约 13 MB。
