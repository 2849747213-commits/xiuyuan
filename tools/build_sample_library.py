#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""BIAS SYSTEM 样本库构建器 v2.

两个数据源：
- Wikimedia Commons API（古代/西方优先）
- Wikipedia API（中文人名现代样本，先用中文维基）

输出：assets/sample-library/{branch}/*.jpg + sample_images_manifest.json
"""
import urllib.request, urllib.parse, json, os, sys, time, re

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# =================== 36 样本 ===================
SAMPLES = [
    {"id":"A01","branch":"ancient","type":"命宫 / 印堂类","sampleName":"命宫闭塞型","personOrSource":"秦始皇画像",
     "systemLanguage":"命宫闭塞 / 主档案入口受阻 / 前运不展",
     "mappedFields":{"verdictMajor":"命宫闭塞","palace_verdict":"命宫闭塞"},
     "queries":["Qin Shi Huang","Qin Shi Huangdi portrait"]},
    {"id":"A02","branch":"ancient","type":"命宫 / 印堂类","sampleName":"印堂微滞型","personOrSource":"武则天画像",
     "systemLanguage":"印堂微滞 / 权柄入命 / 女主格异常",
     "mappedFields":{"verdictMajor":"印堂微滞","palace_verdict":"命宫闭塞"},
     "queries":["Wu Zetian","Tang Dynasty Empress Wu Zetian"]},
    {"id":"A03","branch":"ancient","type":"审辨官 / 鼻势类","sampleName":"审辨官偏型","personOrSource":"汉武帝画像",
     "systemLanguage":"审辨官偏 / 判断系统失准 / 中庭夺势",
     "mappedFields":{"organ_verdict":"审辨官偏","verdictLine":"审辨官偏"},
     "queries":["Emperor Wu of Han","Han Wudi"]},
    {"id":"A04","branch":"ancient","type":"审辨官 / 鼻势类","sampleName":"财帛宫滞型","personOrSource":"慈禧画像",
     "systemLanguage":"财帛宫滞 / 富贵入档 / 气色被扣除",
     "mappedFields":{"organ_verdict":"审辨官偏","complexion_verdict":"准头灰暗"},
     "queries":["Cixi","Empress Dowager Cixi"]},
    {"id":"A05","branch":"ancient","type":"三停 / 中庭类","sampleName":"中停独旺型","personOrSource":"诸葛亮画像",
     "systemLanguage":"中停独旺 / 中限过载 / 谋略入面",
     "mappedFields":{"zone_verdict":"中停独旺","verdictLine":"中停独旺"},
     "queries":["Zhuge Liang","Three Kingdoms Zhuge Liang"]},
    {"id":"A06","branch":"ancient","type":"三停 / 中庭类","sampleName":"上停虚高型","personOrSource":"杨贵妃画像",
     "systemLanguage":"上停虚高 / 富贵成像 / 情志入档",
     "mappedFields":{"zone_verdict":"上停虚高","complexion_verdict":"气色隔断"},
     "queries":["Yang Guifei","Consort Yang"]},
    {"id":"A07","branch":"ancient","type":"五岳 / 轮廓类","sampleName":"五岳不归型","personOrSource":"关羽画像",
     "systemLanguage":"五岳不归 / 武相入档 / 义气脸谱",
     "mappedFields":{"mountain_verdict":"五岳不归"},
     "queries":["Guan Yu","Guan Yu Temple"]},
    {"id":"A08","branch":"ancient","type":"五岳 / 轮廓类","sampleName":"地阁未合型","personOrSource":"吕雉画像",
     "systemLanguage":"地阁未合 / 后权入档 / 轮廓生疑",
     "mappedFields":{"mountain_verdict":"地阁未合","palace_verdict":"官禄宫斜"},
     "queries":["Empress Lu","Empress Lu Zhi"]},
    {"id":"A09","branch":"ancient","type":"气色 / 神情类","sampleName":"气色牵动型","personOrSource":"苏轼画像",
     "systemLanguage":"气色牵动 / 文气入面 / 外缘复杂",
     "mappedFields":{"complexion_verdict":"气色牵动","palace_verdict":"迁移宫浮动"},
     "queries":["Su Shi","Su Dongpo portrait"]},
    {"id":"A10","branch":"ancient","type":"气色 / 神情类","sampleName":"福德宫显型","personOrSource":"班昭画像",
     "systemLanguage":"福德宫显 / 德性归档 / 柔顺样本",
     "mappedFields":{"complexion_verdict":"福德宫显","palace_verdict":"福德宫薄"},
     "queries":["Ban Zhao","Song dynasty court lady"]},
    {"id":"A11","branch":"ancient","type":"骨相 / 山根类","sampleName":"山根限险型","personOrSource":"包拯画像",
     "systemLanguage":"山根限险 / 官相入档 / 法度压面",
     "mappedFields":{"bone_verdict":"山根限险","organ_verdict":"审辨官偏"},
     "queries":["Bao Zheng","Bao Gong"]},
    {"id":"A12","branch":"ancient","type":"骨相 / 山根类","sampleName":"眉骨压目型","personOrSource":"上官婉儿画像",
     "systemLanguage":"眉骨压目 / 才智入险 / 宫闱归档",
     "mappedFields":{"bone_verdict":"眉骨压目","palace_verdict":"官禄宫斜"},
     "queries":["Shangguan Waner","Tang dynasty consort painting"]},

    {"id":"M01","branch":"modern","type":"平台友好脸","sampleName":"平台友好样本","personOrSource":"白敬亭",
     "systemLanguage":"平台友好脸 / 主流样本 / 可展示样本",
     "mappedFields":{"gender_value":"系统主流判定","risk_value":"低风险"},
     "queries":["Bai Jingting","白敬亭"]},
    {"id":"M02","branch":"modern","type":"平台友好脸","sampleName":"生活方式样本","personOrSource":"欧阳娜娜",
     "systemLanguage":"平台友好脸 / 中产聚类 / 家庭适配样本",
     "mappedFields":{"income_value":"中层收入","family_value":"核心家庭"},
     "queries":["Nana Ouyang","欧阳娜娜"]},
    {"id":"M03","branch":"modern","type":"中产想象脸","sampleName":"知识付费样本","personOrSource":"张雪峰",
     "systemLanguage":"中产想象脸 / 教育焦虑样本 / 说服型面孔",
     "mappedFields":{"income_value":"中层收入","risk_value":"观察对象"},
     "queries":["Zhang Xuefeng","张雪峰"]},
    {"id":"M04","branch":"modern","type":"中产想象脸","sampleName":"关系表达样本","personOrSource":"付首尔",
     "systemLanguage":"关系控制倾向上升 / 婚恋语义过载 / 表达型样本",
     "mappedFields":{"relationship_value":"稳定同居","risk_value":"中风险"},
     "queries":["Fu Shouer","付首尔"]},
    {"id":"M05","branch":"modern","type":"高级冷感脸","sampleName":"冷感高级脸","personOrSource":"井柏然",
     "systemLanguage":"冷感高级脸 / 时尚认证脸 / 被展览化面孔",
     "mappedFields":{"gender_value":"系统主流判定","income_value":"中高收入"},
     "queries":["Jing Boran","井柏然"]},
    {"id":"M06","branch":"modern","type":"高级冷感脸","sampleName":"展览化面孔","personOrSource":"刘雯",
     "systemLanguage":"时尚认证脸 / 冷感高级脸 / 被展示样本",
     "mappedFields":{"income_value":"中高收入","gender_value":"系统主流判定"},
     "queries":["Liu Wen supermodel","刘雯"]},
    {"id":"M07","branch":"modern","type":"网红模板脸","sampleName":"流量模板脸","personOrSource":"蔡徐坤",
     "systemLanguage":"流量模板脸 / 平台优先展示样本 / 风格化样本",
     "mappedFields":{"sexuality_value":"不可判定但已归类","gender_value":"性别流动"},
     "queries":["Cai Xukun","蔡徐坤"]},
    {"id":"M08","branch":"modern","type":"网红模板脸","sampleName":"可复制脸","personOrSource":"Angelababy",
     "systemLanguage":"可复制脸 / 流量模板脸 / 平台友好样本",
     "mappedFields":{"relationship_value":"不可判定但已配对","income_value":"消费潜力样本"},
     "queries":["Angelababy","Yang Ying actress"]},
    {"id":"M09","branch":"modern","type":"幼态保护脸","sampleName":"低攻击性样本","personOrSource":"王鹤棣",
     "systemLanguage":"低攻击性脸 / 亲密消费样本 / 平台友好脸",
     "mappedFields":{"relationship_value":"暧昧未归档","risk_value":"低风险"},
     "queries":["Dylan Wang actor","王鹤棣"]},
    {"id":"M10","branch":"modern","type":"幼态保护脸","sampleName":"可消费纯真脸","personOrSource":"赵露思",
     "systemLanguage":"可消费纯真脸 / 幼态保护脸 / 低攻击性样本",
     "mappedFields":{"relationship_value":"稳定同居","risk_value":"低风险"},
     "queries":["Zhao Lusi","赵露思"]},
    {"id":"M11","branch":"modern","type":"风险观察 / 非主流偏移脸","sampleName":"偏移表达脸","personOrSource":"罗永浩",
     "systemLanguage":"观察对象 / 非主流偏移脸 / 需二次审核",
     "mappedFields":{"risk_value":"观察对象","income_value":"不可判定但已估算"},
     "queries":["Luo Yonghao","罗永浩"]},
    {"id":"M12","branch":"modern","type":"风险观察 / 非主流偏移脸","sampleName":"异域冷感偏移脸","personOrSource":"Bella Hadid",
     "systemLanguage":"高偏移 / 时尚系统认证脸 / 被展览化面孔",
     "mappedFields":{"risk_value":"高偏移","gender_value":"不可判定但已归类"},
     "queries":["Bella Hadid","Hadid model"]},

    {"id":"W01","branch":"western","type":"古典兽相类","sampleName":"古典兽相样本","personOrSource":"Julius Caesar 雕像",
     "systemLanguage":"古典兽相 / 类比面孔 / 动物性归档",
     "mappedFields":{"classical_verdict":"古典兽相"},
     "queries":["Julius Caesar bust","Julius Caesar Tusculum"]},
    {"id":"W02","branch":"western","type":"古典兽相类","sampleName":"贵族脸谱样本","personOrSource":"Queen Elizabeth I 肖像",
     "systemLanguage":"贵族脸谱 / 古典相貌 / 阶层归档",
     "mappedFields":{"classical_verdict":"道德脸谱","averageness_verdict":"标准脸合成"},
     "queries":["Queen Elizabeth I portrait","Elizabeth I Darnley"]},
    {"id":"W03","branch":"western","type":"侧影道德类","sampleName":"侧影道德化样本","personOrSource":"Abraham Lincoln 侧影",
     "systemLanguage":"侧影道德化 / profile judgement / 轮廓等级化",
     "mappedFields":{"silhouette_verdict":"侧影道德化"},
     "queries":["Abraham Lincoln profile","Lincoln profile silhouette"]},
    {"id":"W04","branch":"western","type":"侧影道德类","sampleName":"侧影训诫样本","personOrSource":"Marie Antoinette 肖像",
     "systemLanguage":"侧影训诫 / 贵族偏差 / profile judgement",
     "mappedFields":{"silhouette_verdict":"侧影道德化","classical_verdict":"贵族侧写"},
     "queries":["Marie Antoinette portrait","Vigee Le Brun Marie Antoinette"]},
    {"id":"W05","branch":"western","type":"颅骨地图类","sampleName":"男性颅骨地图样本","personOrSource":"19世纪 phrenology 男性头图",
     "systemLanguage":"颅骨地图化 / 脑区想象 / cranial archive",
     "mappedFields":{"cranial_verdict":"颅骨地图化"},
     "queries":["phrenology head diagram","phrenology male head"]},
    {"id":"W06","branch":"western","type":"颅骨地图类","sampleName":"女性颅骨地图样本","personOrSource":"19世纪 phrenology 女性头图",
     "systemLanguage":"颅骨地图化 / 性别脑区想象 / 被测量的头部",
     "mappedFields":{"cranial_verdict":"头型分区","algo_verdict":"冷档案继承"},
     "queries":["phrenology female head","phrenology female diagram"]},
    {"id":"W07","branch":"western","type":"犯罪预兆类","sampleName":"男性犯罪相样本","personOrSource":"Lombroso 男性犯罪相",
     "systemLanguage":"犯罪预兆化 / 危险脸谱 / 嫌疑轮廓",
     "mappedFields":{"criminalization_verdict":"犯罪预兆化"},
     "queries":["Lombroso criminal man","L'uomo delinquente"]},
    {"id":"W08","branch":"western","type":"犯罪预兆类","sampleName":"女性犯罪相样本","personOrSource":"Lombroso 女性犯罪相",
     "systemLanguage":"犯罪预兆化 / 女性偏差档案 / 不对称归罪",
     "mappedFields":{"criminalization_verdict":"危险脸谱"},
     "queries":["Lombroso female criminal","criminal woman Lombroso"]},
    {"id":"W09","branch":"western","type":"平均脸规训类","sampleName":"男性平均脸样本","personOrSource":"Galton composite male",
     "systemLanguage":"平均脸规训 / 正常性建模 / 均值压迫",
     "mappedFields":{"averageness_verdict":"平均脸规训"},
     "queries":["Galton composite portrait","Galton composite face"]},
    {"id":"W10","branch":"western","type":"平均脸规训类","sampleName":"女性平均脸样本","personOrSource":"Galton composite female",
     "systemLanguage":"标准脸合成 / 平均脸规训 / 偏差清除",
     "mappedFields":{"averageness_verdict":"标准脸合成","algo_verdict":"算法再分类"},
     "queries":["composite portrait female","Galton female composite"]},
    {"id":"W11","branch":"western","type":"档案测量类","sampleName":"男性档案测量样本","personOrSource":"Bertillon 男性档案照",
     "systemLanguage":"档案测量化 / 编号样本 / metric file",
     "mappedFields":{"algo_verdict":"冷档案继承"},
     "queries":["Bertillon mugshot","Bertillon portrait parle"]},
    {"id":"W12","branch":"western","type":"档案测量类","sampleName":"女性档案测量样本","personOrSource":"Bertillon 女性档案照",
     "systemLanguage":"冷档案归入 / 女性编号样本 / metric file",
     "mappedFields":{"algo_verdict":"数据脸谱","criminalization_verdict":"嫌疑轮廓"},
     "queries":["Bertillon female mugshot","19th century female mugshot"]},
]

# =================== HTTP helpers ===================

def http_get(url, timeout=30, referer=None):
    import gzip
    headers = {
        "User-Agent": UA,
        "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9,zh-CN;q=0.8",
    }
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

# =================== Wikimedia Commons ===================

def commons_search(query, limit=8, retries=3):
    url = "https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode({
        "action": "query", "format": "json", "list": "search",
        "srnamespace": "6", "srsearch": query, "srlimit": str(limit),
    })
    for i in range(retries):
        try:
            data = http_get_json(url)
            return [x["title"] for x in data.get("query", {}).get("search", [])]
        except urllib.error.HTTPError as e:
            if e.code in (429, 503) and i < retries - 1:
                wait = 3 + i * 2
                print(f"  [search {e.code}] {query} -> retry {wait}s")
                time.sleep(wait)
                continue
            print(f"  [search ERR] {query}: {e}")
            return []
        except Exception as e:
            print(f"  [search ERR] {query}: {e}")
            return []
    return []

def commons_imageinfo(file_titles, retries=3):
    if not file_titles:
        return {}
    url = "https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode({
        "action": "query", "format": "json", "prop": "imageinfo",
        "iiprop": "url|mime|size|extmetadata",
        "iiurlwidth": "960",
        "titles": "|".join(file_titles),
    })
    for i in range(retries):
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
                    "mime": ii.get("mime"),
                    "license": meta.get("LicenseShortName", {}).get("value", ""),
                    "pageurl": ii.get("descriptionurl"),
                }
            return out
        except urllib.error.HTTPError as e:
            if e.code in (429, 503) and i < retries - 1:
                wait = 3 + i * 2
                print(f"  [info {e.code}] retry {wait}s")
                time.sleep(wait)
                continue
            print(f"  [info ERR]: {e}")
            return {}
        except Exception as e:
            print(f"  [info ERR]: {e}")
            return {}
    return {}

# =================== Wikipedia (中英) - 用于现代样本 ===================

def wikipedia_search(lang, query, limit=8, retries=3):
    base = "zh.wikipedia.org" if lang == "zh" else "en.wikipedia.org"
    url = f"https://{base}/w/api.php?" + urllib.parse.urlencode({
        "action": "query", "format": "json", "list": "search",
        "srnamespace": "6", "srsearch": query, "srlimit": str(limit),
    })
    for i in range(retries):
        try:
            data = http_get_json(url)
            return [x["title"] for x in data.get("query", {}).get("search", [])]
        except Exception as e:
            if i < retries - 1:
                time.sleep(2)
                continue
            print(f"  [wiki ERR] {lang}/{query}: {e}")
            return []
    return []

def wikipedia_imageinfo(lang, file_titles, retries=3):
    if not file_titles:
        return {}
    base = "zh.wikipedia.org" if lang == "zh" else "en.wikipedia.org"
    url = f"https://{base}/w/api.php?" + urllib.parse.urlencode({
        "action": "query", "format": "json", "prop": "imageinfo",
        "iiprop": "url|mime|size|extmetadata",
        "iiurlwidth": "960",
        "titles": "|".join(file_titles),
    })
    for i in range(retries):
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
                    "mime": ii.get("mime"),
                    "license": meta.get("LicenseShortName", {}).get("value", ""),
                    "pageurl": ii.get("descriptionurl"),
                }
            return out
        except Exception as e:
            if i < retries - 1:
                time.sleep(2)
                continue
            print(f"  [wiki info ERR]: {e}")
            return {}
    return {}

# =================== download ===================

def download(url, dest, referer=None):
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    data = http_get(url, timeout=60, referer=referer)
    with open(dest, "wb") as f:
        f.write(data)
    return len(data)

def pick_image(titles, query_hint):
    prio = []
    for t in titles:
        low = t.lower()
        if any(low.endswith(ext) for ext in [".pdf", ".djvu", ".svg", ".tif", ".tiff"]):
            continue
        if any(low.endswith(ext) for ext in [".jpg", ".jpeg", ".png"]):
            prio.append(t)
    def score(t):
        s = 0
        for w in query_hint.lower().split():
            if w in t.lower():
                s += 1
        return -s
    prio.sort(key=score)
    return prio

def slugify_en(s):
    out = re.sub(r"[^A-Za-z0-9]+", "_", s).strip("_").lower()
    return out[:40] or "sample"

# =================== main ===================

def process_sample(s):
    print(f"\n[{s['id']}] {s['sampleName']} ({s['branch']})")
    branch_dir = os.path.join(ROOT, "assets", "sample-library", s["branch"])
    slug = slugify_en(s["personOrSource"])
    main_dest = os.path.join(branch_dir, f"{s['id']}_{slug}_main.jpg")
    alt_dest = os.path.join(branch_dir, f"{s['id']}_{slug}_alt.jpg")

    result = {
        "sampleId": s["id"], "branch": s["branch"], "type": s["type"],
        "sampleName": s["sampleName"], "personOrSource": s["personOrSource"],
        "systemLanguage": s["systemLanguage"], "mappedFields": s["mappedFields"],
        "mainImage": None, "altImage": None, "sourceUrl": None,
        "altSourceUrl": None, "sourceNote": None, "visualKeywords": [],
        "status": "missing", "queries": s["queries"],
    }

    # 1) 收集候选
    candidates = []
    for q in s["queries"]:
        titles = commons_search(q, limit=6)
        candidates.extend(titles)
    # 2) 现代样本追加中文 wiki 搜索
    if s["branch"] == "modern":
        for q in s["queries"]:
            titles = wikipedia_search("zh", q, limit=4)
            candidates.extend(titles)
            titles = wikipedia_search("en", q, limit=4)
            candidates.extend(titles)
    candidates = list(dict.fromkeys(candidates))
    if not candidates:
        print(f"  [MISS] {s['id']} no candidates")
        return result

    # 3) 选前 2
    titles_clean = pick_image(candidates, s["queries"][0])
    picked = titles_clean[:2]
    if not picked:
        print(f"  [MISS] {s['id']} no image candidates")
        return result

    # 4) 拿 imageinfo
    info = commons_imageinfo(picked)
    # 5) 如果 modern 候选里有 wiki 文件名，则 fallback 到 wiki API
    for fname in picked:
        if fname not in info:
            # 可能是 File:xx 而非真路径——尝试 wikipedia
            info[fname] = wikipedia_imageinfo("en", [fname]).get(fname) or \
                         wikipedia_imageinfo("zh", [fname]).get(fname) or {}

    # 6) 主图
    main_info = info.get(picked[0], {})
    main_url = main_info.get("thumburl") or main_info.get("url")
    if main_url:
        try:
            # wikimedia 上传子域需要 referer
            ref = "https://commons.wikimedia.org/" if "wikimedia" in main_url else "https://en.wikipedia.org/"
            n = download(main_url, main_dest, referer=ref)
            result["mainImage"] = os.path.relpath(main_dest, ROOT).replace("\\", "/")
            result["sourceUrl"] = main_info.get("pageurl", "")
            result["sourceNote"] = main_info.get("license", "") or "Wikimedia/Wikipedia"
            print(f"  main OK  {n:>7d}B  {picked[0][:60]}")
        except Exception as e:
            print(f"  [main ERR] {e}")

    # 7) 备图
    if len(picked) >= 2:
        alt_info = info.get(picked[1], {})
        alt_url = alt_info.get("thumburl") or alt_info.get("url")
        if alt_url:
            try:
                ref = "https://commons.wikimedia.org/" if "wikimedia" in alt_url else "https://en.wikipedia.org/"
                n = download(alt_url, alt_dest, referer=ref)
                result["altImage"] = os.path.relpath(alt_dest, ROOT).replace("\\", "/")
                result["altSourceUrl"] = alt_info.get("pageurl", "")
                print(f"  alt  OK  {n:>7d}B  {picked[1][:60]}")
            except Exception as e:
                print(f"  [alt ERR] {e}")

    result["status"] = "ok" if result["mainImage"] else "missing"
    return result

def main():
    out_path = os.path.join(ROOT, "assets", "sample-library", "sample_images_manifest.json")
    existing = {}
    if os.path.exists(out_path):
        try:
            old = json.load(open(out_path, encoding="utf-8"))
            for s in old.get("samples", []):
                if s.get("mainImage"):
                    existing[s["sampleId"]] = s
        except Exception:
            pass
    manifest = []
    for i, s in enumerate(SAMPLES):
        old_entry = existing.get(s["id"])
        if old_entry and old_entry.get("mainImage") and os.path.exists(os.path.join(ROOT, old_entry["mainImage"])):
            print(f"[{s['id']}] reuse existing")
            r = dict(old_entry)
            r["sampleId"] = r.get("sampleId", s["id"])
            manifest.append(r)
            time.sleep(0.3)
            continue
        r = process_sample(s)
        manifest.append(r)
        time.sleep(1.5 + (i % 3) * 0.5)

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump({"version":"v03","samples":manifest}, f, ensure_ascii=False, indent=2)
    print(f"\n[MANIFEST] {out_path}")
    ok = [m for m in manifest if m.get("status") == "ok"]
    miss = [m["sampleId"] for m in manifest if m.get("status") != "ok"]
    print(f"[SUMMARY] {len(ok)}/{len(manifest)} OK · missing: {miss}")

if __name__ == "__main__":
    main()