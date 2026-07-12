#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""按用户给的文件名映射更新 modern 段 manifest.
纯本地路径替换，不识别图片内容、不调用视觉模型."""
import json, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MANIFEST = os.path.join(ROOT, "assets", "sample-library", "sample_images_manifest.json")
BOARD = os.path.join(ROOT, "_preview", "sample-library", "modern_sample_board.html")

# 用户提供的现代样本 12 套映射
UPDATES = {
    "M01": {
        "mainImage": "assets/sample-library/modern/fushouer.webp",
        "altImage":  "assets/sample-library/modern/1200X900_pub_cb202412021618401252278wt.jpg_6a26dd5dd6494895bfea442d23286571.jpg",
        "sourceNote": "用户提供 · 本地素材（fushouer / alt 副图）",
    },
    "M02": {
        "mainImage": "assets/sample-library/modern/zhangxuefen.jpg",
        "altImage":  None,
        "sourceNote": "用户提供 · 本地素材（zhangxuefen）",
    },
    "M03": {
        "mainImage": "assets/sample-library/modern/mimiyan.webp",
        "altImage":  "assets/sample-library/modern/mimiyan (2).webp",
        "sourceNote": "用户提供 · 本地素材（mimiyan + 副图）",
    },
    "M04": {
        "mainImage": "assets/sample-library/modern/terlangpu.webp",
        "altImage":  "assets/sample-library/modern/telangpu.webp",
        "backupImage": "assets/sample-library/modern/M12_sample_main.jpg",
        "sourceNote": "用户提供 · 本地素材（terlangpu / telangpu alt）",
    },
    "M05": {
        "mainImage": "assets/sample-library/modern/caixukun.webp",
        "altImage":  None,
        "sourceNote": "用户提供 · 本地素材（caixukun）",
    },
    "M06": {
        "mainImage": None,
        "contextImage": "assets/sample-library/modern/M09_karoshi_main.jpg",
        "sourceNote": "无主图 / contextImage 复用 M09_karoshi_main",
    },
    "M07": {
        "mainImage": "assets/sample-library/modern/M11_sample_main.jpg",
        "altImage":  None,
        "sourceNote": "复用 M11 旧文件名（M07 本身无主图）",
    },
    "M08": {"mainImage": None, "altImage": None, "sourceNote": "无主图（用户移除 M08_sample_main 作 modern 主图）"},
    "M09": {"mainImage": None, "contextImage": "assets/sample-library/modern/M09_karoshi_main.jpg",
             "sourceNote": "karoshi 旧主图作为 M09 contextImage（不当主图）"},
    "M10": {"mainImage": None, "altImage": None, "sourceNote": "无主图（用户移除 M10_sample_main）"},
    "M11": {"mainImage": None, "altImage": None, "sourceNote": "主图被 M07 复用为示例"},
    "M12": {"mainImage": None, "altImage": None, "sourceNote": "主图作为 M04 backupImage"},
}

def main():
    # ---- update manifest ----
    m = json.load(open(MANIFEST, encoding="utf-8"))
    by_id = {s["sampleId"]: s for s in m["samples"] if s["branch"] == "modern"}

    missing_no_path = []
    for sid, upd in UPDATES.items():
        s = by_id.get(sid)
        if not s: continue
        main = upd.get("mainImage")
        # 如果 main 给了但本地文件不存在，记 missing
        if main and not os.path.exists(os.path.join(ROOT, main)):
            missing_no_path.append((sid, "main", main))
        if upd.get("altImage"):
            altp = os.path.join(ROOT, upd["altImage"])
            if not os.path.exists(altp):
                missing_no_path.append((sid, "alt", upd["altImage"]))
        # 写回
        for k in ("mainImage", "altImage", "contextImage", "backupImage"):
            if k in upd:
                s[k] = upd[k]
        note = upd.get("sourceNote")
        if note:
            s["sourceNote"] = note
        # status 根据 main 是否存在来判定
        s["status"] = "ok" if main else "context_only"
    with open(MANIFEST, "w", encoding="utf-8") as f:
        json.dump(m, f, ensure_ascii=False, indent=2)

    if missing_no_path:
        # code-side notice only; do not print info text to console reply
        pass

    # ---- rebuild modern_sample_board.html with the updated paths ----
    # Reuse build_modern_board.py logic but call it again
    import subprocess, sys
    sys.path.insert(0, os.path.dirname(__file__))
    # We just call the board builder directly
    from build_modern_board import main as build_board
    build_board()

if __name__ == "__main__":
    main()