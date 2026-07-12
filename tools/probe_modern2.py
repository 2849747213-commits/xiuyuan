#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""用 Wikipedia parser API 直接抓每个现代样本对应词条的 lead image."""
import urllib.request, urllib.parse, json, time

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"

# 每个样本对应一组 Wikipedia 词条标题（中英）
TARGETS = {
    "M01": [
        # 付首尔
        ("zh", "傅首尔"),
        ("en", "Fu Shouer"),
    ],
    "M02": [
        # 眯眯眼 / 三只松鼠广告争议
        ("en", "Racist slanted eye controversy"),
        ("en", "Slanted Eyes"),
        ("en", "Three Squirrels"),
        ("zh", "三只松鼠"),
    ],
    "M03": [
        # 高级脸 / 杜鹃 / 雎晓雯
        ("en", "Du Juan (model)"),
        ("en", "Ju Xiaowen"),
        ("zh", "杜鹃"),
        ("zh", "雎晓雯"),
    ],
    "M04": [
        # 网红脸 / 早期网红
        ("en", "Internet celebrity"),
        ("en", "Web celebrity"),
        ("zh", "网络名人"),
    ],
    "M05": [
        # 幼态脸
        ("en", "Neoteny"),
        ("en", "Cute culture"),
        ("zh", "幼态"),
    ],
    "M06": [
        # 医美 / 科技脸
        ("en", "Plastic surgery"),
        ("en", "Botox"),
        ("zh", "整容"),
    ],
    "M07": [
        # 妈生感
        ("zh", "妈生感"),
        ("en", "Natural beauty"),
    ],
    "M08": [
        # 苦相脸
        ("en", "Resting bitch face"),
        ("en", "Bitter face"),
        ("zh", "疲惫"),
    ],
    "M09": [
        # 班味
        ("en", "Karoshi"),
        ("en", "Office worker"),
        ("zh", "班味"),
        ("zh", "打工人"),
    ],
    "M10": [
        # 好嫁风
        ("en", "Yamato Nadeshiko"),
        ("en", "Traditional wife"),
        ("zh", "好嫁风"),
    ],
    "M11": [
        # 厌世脸
        ("en", "Komatsu Nana"),
        ("en", "Apathetic facial expression"),
        ("zh", "小松菜奈"),
    ],
    "M12": [
        # 政治表演脸
        ("en", "Donald Trump"),
        ("en", "Political theater"),
        ("zh", "特朗普"),
    ],
}

def http_get_json(url, timeout=30, retries=3):
    for i in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=timeout) as r:
                data = r.read()
                if r.headers.get("Content-Encoding") == "gzip":
                    import gzip
                    data = gzip.decompress(data)
                return json.loads(data.decode("utf-8"))
        except Exception as e:
            if i < retries - 1:
                time.sleep(2 + i * 2)
                continue
            raise
    return None

def page_lead_image(lang, title):
    """parser API: returns lead image URL (thumbnail 960)."""
    base = "zh.wikipedia.org" if lang == "zh" else "en.wikipedia.org"
    api = f"https://{base}/w/api.php?" + urllib.parse.urlencode({
        "action": "query", "format": "json",
        "prop": "pageimages|pageprops",
        "piprop": "thumbnail",
        "pithumbsize": "960",
        "redirects": "1",
        "titles": title,
    })
    data = http_get_json(api)
    if not data: return None
    pages = data.get("query", {}).get("pages", {})
    for p in pages.values():
        thumb = p.get("thumbnail", {}).get("source")
        return thumb
    return None

results = {}
for sid, tries in TARGETS.items():
    print(f"\n=== {sid} ===")
    found = None
    for lang, title in tries:
        try:
            url = page_lead_image(lang, title)
        except Exception as e:
            url = None
            print(f"  [ERR {lang}/{title}] {e}")
        if url:
            print(f"  OK [{lang}/{title}] {url[:100]}")
            found = (lang, title, url)
            break
        else:
            print(f"  miss [{lang}/{title}]")
        time.sleep(0.5)
    results[sid] = found

import os
os.makedirs(os.path.join(os.path.dirname(__file__), "..", "tools"), exist_ok=True)
with open(os.path.join(os.path.dirname(__file__), "..", "tools", "modern_image_urls.json"), "w", encoding="utf-8") as f:
    json.dump(results, f, ensure_ascii=False, indent=2)
print("\n[SAVED] tools/modern_image_urls.json")