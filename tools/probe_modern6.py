#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""为 4 个 missing 样本尝试抽象议题 lead image。"""
import urllib.request, urllib.parse, json, time, gzip

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"

def page_lead(lang, title):
    base = "zh.wikipedia.org" if lang == "zh" else "en.wikipedia.org"
    api = f"https://{base}/w/api.php?" + urllib.parse.urlencode({
        "action": "query", "format": "json",
        "prop": "pageimages", "piprop": "thumbnail",
        "pithumbsize": "960", "redirects": "1",
        "titles": title,
    })
    for retry in range(4):
        try:
            req = urllib.request.Request(api, headers={"User-Agent": UA, "Accept-Encoding": "gzip"})
            with urllib.request.urlopen(req, timeout=15) as r:
                data = r.read()
                if r.headers.get("Content-Encoding") == "gzip":
                    data = gzip.decompress(data)
                d = json.loads(data)
                for p in d.get("query", {}).get("pages", {}).values():
                    return p.get("thumbnail", {}).get("source")
            return None
        except Exception as e:
            wait = 3 + retry * 2
            print(f"  [retry {retry+1}] {e}  wait {wait}s")
            time.sleep(wait)
    return None

ATTEMPTS = {
    "M01": [
        ("zh", "脱口秀大会_(综艺节目)"),
        ("zh", "再见爱人"),
        ("zh", "傅首尔"),
        ("en", "Talk show"),
        ("en", "Feminism in China"),
    ],
    "M02": [
        ("en", "Orientalism"),
        ("en", "Yellowface"),
        ("en", "Anti-Chinese sentiment"),
        ("en", "Sinophobic caricature of Chinese people"),
    ],
    "M04": [
        ("zh", "网红"),
        ("en", "Internet celebrity"),
        ("en", "Social media influencer"),
        ("en", "Web celebrity"),
    ],
    "M07": [
        ("en", "Natural beauty"),
        ("en", "Korean beauty standards"),
        ("en", "Plastic surgery"),
        ("en", "Beauty"),
    ],
}

results = {}
for sid, tries in ATTEMPTS.items():
    print(f"\n=== {sid} ===")
    found = None
    for lang, title in tries:
        url = page_lead(lang, title)
        if url:
            print(f"  OK [{lang}/{title}] {url[:90]}")
            found = (lang, title, url)
            break
        print(f"  miss [{lang}/{title}]")
        time.sleep(0.8)
    results[sid] = found

print("\n=== SUMMARY ===")
for sid, v in results.items():
    if v:
        print(f"  {sid}: {v[0]}/{v[1]} -> {v[2][:80]}")
    else:
        print(f"  {sid}: MISSING")

# 保存到 modern_image_urls.json (合并)
old_path = "tools/modern_image_urls.json"
try:
    old = json.load(open(old_path, encoding="utf-8"))
except Exception:
    old = {}

for sid, v in results.items():
    if v:
        old[sid] = v[2]

old = {k: v for k, v in old.items() if isinstance(v, str) and v.startswith("http")}
with open(old_path, "w", encoding="utf-8") as f:
    json.dump(old, f, ensure_ascii=False, indent=2)