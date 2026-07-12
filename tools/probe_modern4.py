#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""第三轮：找 modern 段真正有'人脸特征'的代表作（公共议题 / 概念脸）."""
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

def commons_image_search(q, limit=12):
    """commons search 按文件名 .jpg/.png 过滤"""
    url = "https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode({
        "action": "query", "format": "json", "list": "search",
        "srnamespace": "6", "srsearch": q, "srlimit": str(limit),
    })
    data = http_get_json(url)
    if not data: return []
    titles = [x["title"] for x in data.get("query", {}).get("search", [])]
    return [t for t in titles if any(t.lower().endswith(e) for e in [".jpg",".jpeg",".png"])][:limit]

def commons_imageinfo(titles):
    if not titles: return []
    url = "https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode({
        "action": "query", "format": "json", "prop": "imageinfo|revisions",
        "iiprop": "url|extmetadata",
        "iiurlwidth": "960",
        "rvprop": "content",  # not needed
        "titles": "|".join(titles),
    })
    data = http_get_json(url)
    if not data: return []
    out = []
    for p in data.get("query", {}).get("pages", {}).values():
        ii = p.get("imageinfo", [{}])[0]
        title = p.get("title", "")
        out.append({
            "title": title,
            "thumburl": ii.get("thumburl"),
            "url": ii.get("url"),
            "pageurl": ii.get("descriptionurl"),
            "license": (ii.get("extmetadata") or {}).get("LicenseShortName", {}).get("value", ""),
            "width": ii.get("thumbwidth"),
            "height": ii.get("thumbheight"),
        })
    return out

def page_lead_image(lang, title):
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

# 每个样本的精确查询（必须人脸特写 / 与议题强相关）
# 每个 query 配一组 (kind, query, must_contain)  # must_contain: 文件名必须包含至少一个
QUERIES = [
    # M01 傅首尔 - 中文 wiki 没有，直接放弃 → fallback 用"中国脱口秀 女演员"
    ("M01", "wiki-zh", "傅首尔", None),
    ("M01", "wiki-zh", "麦琳_(演员)", None),
    ("M01", "commons", "Fu Shouer talk show", ["fu", "shouer", "fuxiaoyao", "fuxiao"]),
    ("M01", "commons", "Chinese female talk show host", ["talk", "host"]),

    # M02 眯眯眼 / 辱华 - 找特定模特
    ("M02", "commons", "Gigi Hadid slanted eye controversy", ["hadid", "gigi", "slanted"]),
    ("M02", "commons", "Qin Lan model Asian face controversy", ["qin", "lan", "model"]),
    ("M02", "commons", "Chinese fashion model portrait", ["model", "fashion"]),

    # M03 高级脸 - 已有 Ju Xiaowen
    # M04 网红脸 - 用 Wang Hong Chinese OR "Internet celebrity" portrait
    ("M04", "commons", "Wang Hong internet celebrity China", ["wang", "hong", "celebrity"]),
    ("M04", "commons", "Live streamer Chinese portrait", ["streamer", "stream"]),
    ("M04", "commons", "Web celebrity portrait", ["celebrity"]),

    # M05 幼态 - neoteny / lolita portrait
    ("M05", "commons", "Lolita fashion portrait cute", ["lolita", "cute"]),
    ("M05", "commons", "Neoteny baby face portrait", ["baby", "neoten"]),
    ("M05", "commons", "Round face cute girl portrait", ["round", "cute"]),

    # M06 科技脸 - botox face
    ("M06", "commons", "botox injection face before after", ["botox", "filler", "injection"]),
    ("M06", "commons", "plastic surgery face before after", ["surgery", "before"]),
    ("M06", "commons", "cosmetic procedure face", ["cosmetic", "face"]),

    # M07 妈生感 - natural beauty face
    ("M07", "commons", "natural beauty face no makeup", ["natural", "beauty"]),
    ("M07", "commons", "Korean idol natural face portrait", ["idol", "face"]),
    ("M07", "commons", "no makeup selfie portrait", ["selfie", "no"]),

    # M08 苦相 - tired face
    ("M08", "commons", "exhausted worker face portrait", ["exhaust", "tired", "worker"]),
    ("M08", "commons", "Resting bitch face example", ["bitch", "resting"]),

    # M09 班味 - karoshi 已有
    # M10 好嫁风 - japanese bride portrait
    ("M10", "commons", "Japanese bride portrait traditional", ["bride", "japanese", "traditional"]),
    ("M10", "commons", "Yamato Nadeshiko portrait woman", ["nadeshiko", "yamato"]),

    # M11 厌世 - 已有 Komatsu Nana
    # M12 政治表演 - 已有 Trump
]

results = {}
for sid, kind, q, must in QUERIES:
    print(f"\n=== {sid} {kind} {q} ===")
    if kind == "wiki-zh":
        url = page_lead_image("zh", q)
    elif kind == "wiki-en":
        url = page_lead_image("en", q)
    elif kind == "commons":
        titles = commons_image_search(q, limit=12)
        url = None
        if titles:
            ii = commons_imageinfo(titles[:6])
            for item in ii:
                tlow = item["title"].lower()
                if must and not any(m.lower() in tlow for m in must):
                    continue
                if item.get("thumburl"):
                    url = item["thumburl"]
                    print(f"  PICK {item['title'][:60]}  lic={item['license']}")
                    break
            if not url and ii:
                # fallback 第一个 jpg
                for item in ii:
                    if item.get("thumburl"):
                        url = item["thumburl"]
                        print(f"  FALLBACK {item['title'][:60]}  lic={item['license']}")
                        break
    else:
        url = None
    if url:
        print(f"  -> {url[:100]}")
        results.setdefault(sid, []).append(url)
    else:
        print(f"  [NONE]")
    time.sleep(1.0)

# 与已有合并；用最新覆盖
old_path = "tools/modern_image_urls.json"
try:
    old = json.load(open(old_path, encoding="utf-8"))
except Exception:
    old = {}
for sid, urls in results.items():
    if urls:
        old[sid] = urls[0]  # 第一个当主图

# 只保留 URL 字符串
old = {k: v for k, v in old.items() if isinstance(v, str) and v.startswith("http")}

with open(old_path, "w", encoding="utf-8") as f:
    json.dump(old, f, ensure_ascii=False, indent=2)

print("\n=== FINAL ===")
for k in sorted(old):
    print(f"  {k}: {old[k][:90]}")
miss = [k for k in ["M01","M02","M03","M04","M05","M06","M07","M08","M09","M10","M11","M12"] if not old.get(k)]
print(f"[MISSING] {miss}")