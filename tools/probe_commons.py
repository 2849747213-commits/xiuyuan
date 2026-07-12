#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Probe Wikimedia Commons API: given query strings, return file titles + imageinfo."""
import urllib.request, urllib.parse, json, sys

UA = "BIAS-System-SampleLibrary/1.0 (research; contact: bias@example.com)"

def commons_search(query, limit=10):
    url = "https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode({
        "action": "query", "format": "json", "list": "search",
        "srnamespace": "6", "srsearch": query, "srlimit": str(limit),
    })
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as r:
        data = json.load(r)
    return [x["title"] for x in data.get("query", {}).get("search", [])]

def commons_imageinfo(file_titles):
    if not file_titles:
        return {}
    url = "https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode({
        "action": "query", "format": "json", "prop": "imageinfo",
        "iiprop": "url|mime|size|extmetadata",
        "iiurlwidth": "1200",
        "titles": "|".join(file_titles),
    })
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as r:
        data = json.load(r)
    out = {}
    for page in data.get("query", {}).get("pages", {}).values():
        ii = page.get("imageinfo", [{}])[0]
        meta = ii.get("extmetadata") or {}
        out[page.get("title")] = {
            "thumburl": ii.get("thumburl"),
            "url": ii.get("url"),
            "width": ii.get("thumbwidth"),
            "height": ii.get("thumbheight"),
            "mime": ii.get("mime"),
            "license": meta.get("LicenseShortName", {}).get("value", ""),
            "artist": meta.get("Artist", {}).get("value", ""),
            "pageurl": ii.get("descriptionurl"),
        }
    return out

if __name__ == "__main__":
    test_queries = [
        "Qin Shi Huang portrait",
        "Wu Zetian portrait painting",
        "Abraham Lincoln profile silhouette",
        "Julius Caesar bust",
        "Bai Jingting",
        "Liu Wen model",
    ]
    for q in test_queries:
        try:
            titles = commons_search(q, limit=4)
            info = commons_imageinfo(titles)
            print(f"\n=== {q} ===  ({len(info)} results)")
            for t, d in info.items():
                print(f"  {t}")
                print(f"    thumb: {(d.get('thumburl') or '')[:90]}")
                print(f"    page : {(d.get('pageurl') or '')[:90]}")
                print(f"    lic  : {d.get('license','')[:50]}")
        except Exception as e:
            print(f"ERR {q}: {e}")