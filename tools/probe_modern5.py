#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""为 8 个 missing 现代样本用 Wikipedia lead image 找概念/事件关联图。"""
import urllib.request, urllib.parse, json, time

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"

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
                time.sleep(3 + i * 2)
                continue
            return None
    return None

def page_lead(lang, title):
    base = "zh.wikipedia.org" if lang == "zh" else "en.wikipedia.org"
    api = f"https://{base}/w/api.php?" + urllib.parse.urlencode({
        "action": "query", "format": "json",
        "prop": "pageimages", "piprop": "thumbnail",
        "pithumbsize": "960", "redirects": "1",
        "titles": title,
    })
    data = http_get_json(api)
    if not data: return None
    pages = data.get("query", {}).get("pages", {})
    for p in pages.values():
        return p.get("thumbnail", {}).get("source")
    return None

# 每个 missing 样本的多组候选（中文 wiki 优先）
TARGETS = {
    "M01": [
        ("zh", "傅首尔"),
        ("zh", "麦琳_(演员)"),
        ("zh", "再见爱人"),
        ("en", "Fu Shouer"),
        ("zh", "脱口秀大会"),
    ],
    "M02": [
        ("en", "Slanted Eyes"),
        ("en", "Three Squirrels"),
        ("en", "Gigi Hadid"),
        ("zh", "三只松鼠"),
        ("en", "Sinophobic caricature of Chinese people"),
        ("en", "Anti-Chinese sentiment"),
    ],
    "M03": [
        ("en", "Du Juan (model)"),
        ("en", "Ju Xiaowen"),
        ("zh", "杜鹃_(模特)"),
        ("zh", "雎晓雯"),
        ("en", "Liu Wen"),
        ("en", "High fashion East Asian model"),
    ],
    "M04": [
        ("en", "Internet celebrity"),
        ("en", "Wang Hong (influencer)"),
        ("zh", "网红"),
        ("zh", "网络主播"),
        ("en", "Chinese internet celebrity"),
    ],
    "M06": [
        ("en", "Plastic surgery"),
        ("en", "Botox"),
        ("en", "Cosmetic surgery"),
        ("zh", "整容"),
        ("en", "Face lift"),
    ],
    "M07": [
        ("en", "Natural beauty"),
        ("en", "Glass skin"),
        ("zh", "妈生感"),
        ("en", "Bare face"),
    ],
    "M10": [
        ("en", "Yamato Nadeshiko"),
        ("en", "Japanese bride"),
        ("en", "Traditional wedding Japan"),
        ("zh", "好嫁风"),
    ],
    "M12": [
        ("en", "Donald Trump"),
        ("en", "Make America Great Again"),
        ("en", "Trump rally"),
        ("zh", "特朗普"),
    ],
}

results = {}
for sid, tries in TARGETS.items():
    print(f"\n=== {sid} ===")
    found = None
    for lang, title in tries:
        try:
            url = page_lead(lang, title)
        except Exception as e:
            url = None
        if url:
            print(f"  OK [{lang}/{title}] {url[:90]}")
            found = url
            break
        print(f"  miss [{lang}/{title}]")
        time.sleep(0.6)
    results[sid] = found

old_path = "tools/modern_image_urls.json"
try:
    old = json.load(open(old_path, encoding="utf-8"))
except Exception:
    old = {}

for sid, url in results.items():
    if url:
        old[sid] = url

# 只保留 URL 字符串
old = {k: v for k, v in old.items() if isinstance(v, str) and v.startswith("http")}

with open(old_path, "w", encoding="utf-8") as f:
    json.dump(old, f, ensure_ascii=False, indent=2)
print("\n=== FINAL ===")
for k in ["M01","M02","M03","M04","M05","M06","M07","M08","M09","M10","M11","M12"]:
    v = old.get(k, "")
    print(f"  {k}: {v[:90] if v else 'MISSING'}")
miss = [k for k in ["M01","M02","M03","M04","M05","M06","M07","M08","M09","M10","M11","M12"] if not old.get(k)]
print(f"\n[STILL MISSING] {miss}")