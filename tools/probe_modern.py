#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""探测 modern 12 样本的 Wikimedia / Wikipedia 图 URL."""
import urllib.request, urllib.parse, json, re

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"

def http_get_json(url, timeout=30):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Encoding": "gzip"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        data = r.read()
        if r.headers.get("Content-Encoding") == "gzip":
            import gzip
            data = gzip.decompress(data)
        return json.loads(data.decode("utf-8"))

# 12 个现代样本的查询词 + 必须含
QUERIES = [
    ("M01", "Fu Shouer host", ["Fu Shouer", "Fuxiaoyao", "付首尔"]),
    ("M02", "slanted eye controversy advertisement", ["slanted", "racist", "Three Squirrels", "squirrel"]),
    ("M03", "Du Juan model China fashion", ["Du Juan", "雎晓雯", "Ju Xiaowen", "fashion"]),
    ("M04", "internet celebrity Chinese livestream", ["internet celebrity", "livestream", "网红"]),
    ("M05", "baby face round cute youthful", ["baby face", "youthful", "sweet"]),
    ("M06", "plastic surgery botox face", ["plastic surgery", "botox", "filler"]),
    ("M07", "natural beauty momsheng", ["natural beauty", "momsheng"]),
    ("M08", "tired woman face struggle", ["tired", "bitter", "苦"]),
    ("M09", "office worker commuter tired", ["office worker", "commuter"]),
    ("M10", "marry friendly wife style Japan", ["marry", "wife", "haigui", "好嫁"]),
    ("M11", "Komatsu Nana apathetic face", ["Komatsu Nana", "apathetic", "disinterested"]),
    ("M12", "Donald Trump campaign speech", ["Trump", "campaign", "rally", "Pence"]),
]

for sid, q, must in QUERIES:
    print(f"\n=== {sid} · {q} ===")
    url = "https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode({
        "action": "query", "format": "json", "list": "search",
        "srnamespace": "6", "srsearch": q, "srlimit": "5",
    })
    try:
        data = http_get_json(url)
        for hit in data.get("query", {}).get("search", []):
            t = hit["title"]
            if any(t.lower().endswith(e) for e in [".pdf", ".djvu", ".svg", ".tif"]):
                continue
            mark = " ★" if any(m.lower() in t.lower() for m in must) else ""
            print(f"  {t}{mark}")
    except Exception as e:
        print(f"  ERR {e}")