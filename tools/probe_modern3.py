#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""第二轮探测：找更精准的"社会议题 / 脸样本"图."""
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
            print(f"  [ERR] {e}")
            return None
    return None

def page_lead_image(lang, title):
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
        return p.get("thumbnail", {}).get("source")
    return None

def commons_search_face(query, limit=8, retries=3):
    """搜 commons 上的图，按 must_have 过滤 .jpg/.png/.jpeg"""
    url = "https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode({
        "action": "query", "format": "json", "list": "search",
        "srnamespace": "6", "srsearch": query, "srlimit": str(limit),
    })
    for i in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=30) as r:
                data = r.read()
                if r.headers.get("Content-Encoding") == "gzip":
                    import gzip
                    data = gzip.decompress(data)
                data = json.loads(data.decode("utf-8"))
            titles = [x["title"] for x in data.get("query", {}).get("search", [])]
            return [t for t in titles if any(t.lower().endswith(e) for e in [".jpg",".jpeg",".png"])][:limit]
        except Exception as e:
            if i < retries - 1:
                time.sleep(3 + i * 2)
                continue
            return []
    return []

# 候选（必须含人脸 / 概念更清晰）
CANDIDATES = {
    "M01": [
        ("zh-wiki", "傅首尔"),
        ("zh-wiki", "傅首尔_(脱口秀演员)"),
        ("zh-wiki", "麦琳"),
        ("commons-q", "Fu Shouer talk show host"),
        ("commons-q", "Fu Shouer Chinese"),
    ],
    "M02": [
        # 眯眯眼争议相关：模特、时尚、广告
        ("commons-q", "slanted eyes model controversy"),
        ("commons-q", "Three Squirrels advertisement"),
        ("commons-q", "slanted eyes ad campaign"),
        ("commons-q", "Gigi Hadid slanted eye"),
        ("commons-q", "Gucci balaclava controversy"),
    ],
    "M04": [
        # 网红脸替代：用 2010s 中国网红讨论相关 OR 用 Wang Hong 词条
        ("commons-q", "Wang Hong internet celebrity"),
        ("commons-q", "Chinese livestream internet celebrity"),
        ("commons-q", "live streaming platform host"),
        ("zh-wiki", "网红"),
    ],
    "M05": [
        # 幼态：用可爱文化 / neoteny / baby face
        ("commons-q", "baby face round cute youthful woman"),
        ("commons-q", "Lolita fashion sweet"),
        ("commons-q", "neoteny cute face"),
        ("zh-wiki", "幼态"),
    ],
    "M06": [
        # 医美科技脸
        ("commons-q", "botox cosmetic face surgery"),
        ("commons-q", "plastic surgery before after face"),
        ("commons-q", "filler face cosmetic procedure"),
        ("zh-wiki", "整容"),
    ],
    "M07": [
        # 妈生感
        ("commons-q", "natural beauty face minimal makeup"),
        ("commons-q", "Korean beauty natural face"),
        ("commons-q", "glass skin natural beauty"),
        ("zh-wiki", "妈生感"),
    ],
    "M08": [
        # 苦相：用 working class face / labor exhaustion
        ("commons-q", "exhausted woman face working class"),
        ("commons-q", "tired worker woman face"),
        ("commons-q", "worn face labor stress"),
        ("zh-wiki", "Resting_bitch_face"),
    ],
    "M10": [
        # 好嫁风
        ("commons-q", "Yamato Nadeshiko portrait woman"),
        ("commons-q", "traditional Japanese wife portrait"),
        ("commons-q", "marriageable Japanese woman"),
        ("commons-q", "oyome bridal portrait"),
    ],
}

results = {}
for sid, tries in CANDIDATES.items():
    print(f"\n=== {sid} ===")
    found = None
    for kind, q in tries:
        if kind == "zh-wiki" or kind == "en-wiki":
            lang = "zh" if kind == "zh-wiki" else "en"
            try:
                url = page_lead_image(lang, q)
            except Exception as e:
                url = None
            if url:
                print(f"  OK [{kind}/{q}] {url[:90]}")
                found = url
                break
            print(f"  miss [{kind}/{q}]")
        elif kind == "commons-q":
            ts = commons_search_face(q, limit=8)
            if ts:
                # 取第一个当候选 URL
                # 我们需要 imageinfo 才能拿到 URL，这里只打印候选
                print(f"  commons candidates for [{q}]: {ts[:3]}")
                # 直接走 imageinfo 取 thumburl
                ii_url = "https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode({
                    "action": "query", "format": "json", "prop": "imageinfo",
                    "iiprop": "url", "iiurlwidth": "960",
                    "titles": "|".join(ts[:2]),
                })
                data = http_get_json(ii_url)
                if data:
                    for p in data.get("query", {}).get("pages", {}).values():
                        ii = p.get("imageinfo", [{}])[0]
                        u = ii.get("thumburl")
                        if u:
                            print(f"  -> {u[:90]}")
                            found = u
                            break
                if found:
                    break
            else:
                print(f"  miss commons [{q}]")
        time.sleep(0.6)
    results[sid] = found

# 与之前结果合并
old_path = "tools/modern_image_urls.json"
try:
    old = json.load(open(old_path, encoding="utf-8"))
    for k, v in old.items():
        if results.get(k) is None and v is not None:
            # 旧值如果是 tuple (lang, title, url) → 提取 url
            if isinstance(v, list) and len(v) == 3:
                results[k] = v[2]
            else:
                results[k] = v
except Exception:
    pass

# 仅保留 URL 字符串
clean = {}
for k, v in results.items():
    if isinstance(v, str):
        clean[k] = v
    elif isinstance(v, list) and len(v) >= 3 and isinstance(v[2], str):
        clean[k] = v[2]

with open(old_path, "w", encoding="utf-8") as f:
    json.dump(clean, f, ensure_ascii=False, indent=2)
print(f"\n[SAVED] {old_path}")
for k in sorted(clean):
    print(f"  {k}: {clean[k][:90] if clean[k] else 'MISSING'}")
miss = [k for k, v in clean.items() if not v]
if miss:
    print(f"\n[MISSING] {miss}")