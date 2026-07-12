#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""针对 manifest 中 status != ok 的样本，重新搜索更精确的查询词。"""
import urllib.request, urllib.parse, json, os, time, re

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# 针对性查询词
FIX_TARGETS = {
    "M04": {
        "queries": ["付首尔 host", "Fu Shouer host", "Fuxiaoyao host"],
        "must_have_any": ["Fu Shouer", "Fuxiaoyao", "付首尔"],
    },
    "W06": {
        "queries": ["phrenology female head", "phrenology woman chart"],
        "must_have_any": ["phrenology"],
        "exclude": ["chart", "guide"],
    },
    "W08": {
        "queries": ["Lombroso donna delinquente plate", "Lombroso criminal woman photograph"],
        "must_have_any": ["Lombroso", "criminal woman"],
    },
    "W11": {
        "queries": ["Alphonse Bertillon portrait parle", "Bertillon mugshot male", "portrait parlé"],
        "must_have_any": ["Bertillon", "parle", "synoptic", "mugshot"],
    },
    "W12": {
        "queries": ["19th century female mugshot", "Bertillon female", "Victorian female criminal portrait"],
        "must_have_any": ["Burdock", "mugshot", "Bertillon", "criminal"],
    },
}

def http_get(url, timeout=30, referer=None):
    import gzip
    headers = {"User-Agent": UA, "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8"}
    if referer:
        headers["Referer"] = referer
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        data = r.read()
        ce = r.headers.get("Content-Encoding", "")
        if ce == "gzip":
            data = gzip.decompress(data)
        elif ce == "deflate":
            import zlib
            data = zlib.decompress(data)
        return data

def http_get_json(url, timeout=30, referer=None):
    return json.loads(http_get(url, timeout, referer).decode("utf-8"))

def commons_search(query, limit=10, retries=3):
    url = "https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode({
        "action": "query", "format": "json", "list": "search",
        "srnamespace": "6", "srsearch": query, "srlimit": str(limit),
    })
    for i in range(retries):
        try:
            data = http_get_json(url)
            return [x["title"] for x in data.get("query", {}).get("search", [])]
        except Exception:
            if i < retries - 1:
                time.sleep(3)
                continue
            return []
    return []

def wiki_search(lang, query, limit=10, retries=3):
    base = "zh.wikipedia.org" if lang == "zh" else "en.wikipedia.org"
    url = f"https://{base}/w/api.php?" + urllib.parse.urlencode({
        "action": "query", "format": "json", "list": "search",
        "srnamespace": "6", "srsearch": query, "srlimit": str(limit),
    })
    for i in range(retries):
        try:
            data = http_get_json(url)
            return [x["title"] for x in data.get("query", {}).get("search", [])]
        except Exception:
            if i < retries - 1:
                time.sleep(2)
                continue
            return []
    return []

def imageinfo(file_titles, lang="commons"):
    if not file_titles: return {}
    base = {"commons": "commons.wikimedia.org", "zh": "zh.wikipedia.org", "en": "en.wikipedia.org"}[lang]
    url = f"https://{base}/w/api.php?" + urllib.parse.urlencode({
        "action": "query", "format": "json", "prop": "imageinfo",
        "iiprop": "url|mime|size|extmetadata", "iiurlwidth": "960",
        "titles": "|".join(file_titles),
    })
    try:
        data = http_get_json(url)
        out = {}
        for page in data.get("query", {}).get("pages", {}).values():
            ii = page.get("imageinfo", [{}])[0]
            meta = ii.get("extmetadata") or {}
            out[page.get("title")] = {
                "thumburl": ii.get("thumburl"),
                "url": ii.get("url"),
                "width": ii.get("thumbwidth"),
                "height": ii.get("thumbheight"),
                "license": meta.get("LicenseShortName", {}).get("value", ""),
                "pageurl": ii.get("descriptionurl"),
            }
        return out
    except Exception:
        return {}

def pick(titles, must_have, exclude=None):
    prio = []
    for t in titles:
        low = t.lower()
        if any(low.endswith(ext) for ext in [".pdf", ".djvu", ".svg", ".tif", ".tiff"]):
            continue
        if any(low.endswith(ext) for ext in [".jpg", ".jpeg", ".png"]):
            if any(m.lower() in low for m in must_have):
                if exclude and any(e.lower() in low for e in exclude):
                    continue
                prio.append(t)
    return prio

def pick_relaxed(titles, exclude=None):
    prio = []
    for t in titles:
        low = t.lower()
        if any(low.endswith(ext) for ext in [".pdf", ".djvu", ".svg", ".tif", ".tiff"]):
            continue
        if any(low.endswith(ext) for ext in [".jpg", ".jpeg", ".png"]):
            if exclude and any(e.lower() in low for e in exclude):
                continue
            prio.append(t)
    return prio

def slugify_en(s):
    return re.sub(r"[^A-Za-z0-9]+", "_", s).strip("_").lower()[:40] or "sample"

def download(url, dest, referer=None):
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    data = http_get(url, timeout=60, referer=referer)
    with open(dest, "wb") as f:
        f.write(data)
    return len(data)

def main():
    mp = os.path.join(ROOT, "assets", "sample-library", "sample_images_manifest.json")
    m = json.load(open(mp, encoding="utf-8"))
    samples_by_id = {s["sampleId"]: s for s in m["samples"]}
    updated = []

    for sid, fix in FIX_TARGETS.items():
        s = samples_by_id.get(sid)
        if not s:
            continue
        if s.get("status") == "ok":
            print(f"[{sid}] already ok, skip")
            continue
        print(f"\n[{sid}] {s['sampleName']} retry ...")
        branch = s["branch"]
        branch_dir = os.path.join(ROOT, "assets", "sample-library", branch)
        slug = slugify_en(s["personOrSource"])

        # 收集候选：先 commons，再 wiki（zh / en）
        candidates = []
        for q in fix["queries"]:
            candidates.extend(commons_search(q, limit=8))
        # M04 走中文 wiki 兜底
        if sid == "M04":
            for q in fix["queries"]:
                candidates.extend(wiki_search("zh", q, limit=6))
                candidates.extend(wiki_search("en", q, limit=6))
        candidates = list(dict.fromkeys(candidates))
        if not candidates:
            print(f"  no candidates")
            continue
        print(f"  candidates: {len(candidates)}")
        picked = pick(candidates, fix["must_have_any"], exclude=fix.get("exclude"))[:2]
        if not picked:
            picked = pick_relaxed(candidates, exclude=fix.get("exclude"))[:2]
            if picked:
                print(f"  [fallback] using any image:", [x[:60] for x in picked])
            else:
                print(f"  no image-format match · candidates head:", candidates[:5])
                continue

        # imageinfo 先 commons，找不到的用 wiki 兜底
        info = imageinfo(picked, "commons")
        for fname in picked:
            if fname not in info:
                # 尝试 wiki
                info[fname] = imageinfo([fname], "zh").get(fname) or imageinfo([fname], "en").get(fname) or {}
        if not info:
            print(f"  no imageinfo")
            continue

        # 主图
        main_info = info.get(picked[0], {})
        main_url = main_info.get("thumburl") or main_info.get("url")
        if main_url:
            try:
                main_dest = os.path.join(branch_dir, f"{sid}_{slug}_main.jpg")
                ref = "https://commons.wikimedia.org/" if "wikimedia" in main_url else "https://en.wikipedia.org/"
                n = download(main_url, main_dest, referer=ref)
                s["mainImage"] = os.path.relpath(main_dest, ROOT).replace("\\", "/")
                s["sourceUrl"] = main_info.get("pageurl", "")
                s["sourceNote"] = main_info.get("license", "") or "Wikimedia/Wikipedia"
                print(f"  main OK {n}B {picked[0][:60]}")
            except Exception as e:
                print(f"  main ERR {e}")
                continue

        # 备图
        if len(picked) >= 2:
            alt_info = info.get(picked[1], {})
            alt_url = alt_info.get("thumburl") or alt_info.get("url")
            if alt_url:
                try:
                    alt_dest = os.path.join(branch_dir, f"{sid}_{slug}_alt.jpg")
                    ref = "https://commons.wikimedia.org/" if "wikimedia" in alt_url else "https://en.wikipedia.org/"
                    n = download(alt_url, alt_dest, referer=ref)
                    s["altImage"] = os.path.relpath(alt_dest, ROOT).replace("\\", "/")
                    s["altSourceUrl"] = alt_info.get("pageurl", "")
                    print(f"  alt  OK {n}B {picked[1][:60]}")
                except Exception as e:
                    print(f"  alt ERR {e}")
        s["status"] = "ok" if s.get("mainImage") else "missing"
        s["queries"] = fix["queries"]
        updated.append(sid)
        time.sleep(2)

    with open(mp, "w", encoding="utf-8") as f:
        json.dump(m, f, ensure_ascii=False, indent=2)
    print(f"\n[UPDATED] {updated}")
    ok = sum(1 for s in m["samples"] if s.get("status") == "ok")
    print(f"[SUMMARY] {ok}/{len(m['samples'])} OK")

if __name__ == "__main__":
    main()