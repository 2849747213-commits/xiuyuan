#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""modern 12 样本：只改 modern 段 manifest + 下载图 + 重生板子。"""
import urllib.request, urllib.parse, json, os, time, re

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# 12 个 modern 样本（与用户原话一一对应）
SAMPLES = [
    {
        "sampleId":"M01","branch":"modern",
        "type":"关系表达 / 婚恋议题",
        "sampleName":"傅首尔脸",
        "personOrSource":"傅首尔 / 麦琳相关舆论中被反复拿来类比的女性表达脸",
        "faceType":"关系表达脸 / 女性公共表达脸",
        "realCase":"傅首尔脱口秀、《再见爱人》麦琳相关舆论、婚恋议题平台辩论",
        "visualKeywords":["强表达","关系控制","综艺辩论","被舆论定性","道德审判"],
        "socialIssue":"女性公共表达被定性 / 婚恋舆论场对女性的道德审判",
        "systemLanguage":"关系控制倾向上升 / 道德审判脸 / 被舆论定性脸",
        "mappedFields":{"relationship_value":"稳定同居","risk_value":"中风险"},
        "queries":["Fu Shouer", "傅首尔"],
        "must_have":[],
        "allowUrls":[],
    },
    {
        "sampleId":"M02","branch":"modern",
        "type":"审美冲突 / 民族符号风险",
        "sampleName":"眯眯眼脸 / 辱华脸",
        "personOrSource":"三只松鼠广告模特争议 / 清华美院毕业设计争议",
        "faceType":"审美冲突脸 / 民族符号风险脸",
        "realCase":"三只松鼠 2021 酸辣粉广告模特眯眯眼争议、清华美院 2021 毕设眯眯眼走秀争议",
        "visualKeywords":["眯眯眼","民族化眼型","广告争议","东方主义凝视","被观看"],
        "socialIssue":"东方主义审美冲突 / 民族符号被征用 / 西方凝视的政治化",
        "systemLanguage":"被观看的东方脸 / 审美冲突脸 / 民族符号风险",
        "mappedFields":{"sexuality_value":"不可判定但已归类","gender_value":"性别凝视"},
        "queries":["slanted eye controversy", "Three Squirrels advertisement", "Qin Lan model"],
        "must_have":["hadid","qin","lan","asian","squirrel","slanted"],
        "allowUrls":[],
    },
    {
        "sampleId":"M03","branch":"modern",
        "type":"西方时尚审美 / 东方脸被凝视",
        "sampleName":"高级脸",
        "personOrSource":"雎晓雯 / 杜鹃类东方高级脸时尚图像（西方时尚语境下的东方脸凝视）",
        "faceType":"高级脸 / 冷感时尚认证脸",
        "realCase":"雎晓雯 2019 巴黎时装周 / 杜鹃长期作为东方'高级脸'符号 / 西方时尚系统中对东方面孔的距离化凝视",
        "visualKeywords":["冷感","骨相","高级","长脸","距离","东方凝视"],
        "socialIssue":"西方时尚审美系统对东方面孔的'高级'化与距离化",
        "systemLanguage":"冷感高级脸 / 被展览化面孔 / 时尚系统认证脸",
        "mappedFields":{"gender_value":"系统主流判定","income_value":"中高收入"},
        "queries":[],
        "must_have":[],
        "allowUrls":[],
    },
    {
        "sampleId":"M04","branch":"modern",
        "type":"平台模板 / 医美审美",
        "sampleName":"网红脸",
        "personOrSource":"中国直播平台 / 早期网红经济图像 / 医美模板脸",
        "faceType":"网红脸 / 可复制脸",
        "realCase":"直播平台兴起的 2016-2020 / 医美机构推行的'网红脸套餐' / 短视频时代的可复制脸模板",
        "visualKeywords":["医美","大眼","锥脸","平台化","可复制","高鼻梁"],
        "socialIssue":"平台化美颜模板 / 医美工业对自然脸的批量改写",
        "systemLanguage":"可复制脸 / 平台友好脸 / 流量模板脸",
        "mappedFields":{"relationship_value":"不可判定但已配对","income_value":"消费潜力样本"},
        "queries":["Wang Hong internet celebrity","直播网红"],
        "must_have":["wang","hong","celebrity","streamer"],
        "allowUrls":[],
    },
    {
        "sampleId":"M05","branch":"modern",
        "type":"女性幼态审美 / 保护欲",
        "sampleName":"幼态脸",
        "personOrSource":"幼态审美 / 甜妹文化 / 医美机构'幼态脸'方案",
        "faceType":"幼态脸 / 可消费纯真脸",
        "realCase":"'幼态脸'医美方案营销 / 甜妹明星 / 平台'保护欲'消费的视觉样本",
        "visualKeywords":["圆润","圆眼","低攻击性","可爱","甜妹","幼态"],
        "socialIssue":"女性幼态化与保护欲消费 / '可爱'的可商品化",
        "systemLanguage":"可消费纯真脸 / 低攻击性脸 / 被保护姿态脸",
        "mappedFields":{"relationship_value":"稳定同居","risk_value":"低风险"},
        "queries":["Lolita fashion sweet","neoteny baby face"],
        "must_have":["lolita","cute","baby","neoten"],
        "allowUrls":[],
    },
    {
        "sampleId":"M06","branch":"modern",
        "type":"医美工业 / 身体商品化",
        "sampleName":"科技脸",
        "personOrSource":"医美过度痕迹 / 苹果肌膨胀 / 表情僵硬相关讨论图",
        "faceType":"科技脸 / 加工痕迹脸",
        "realCase":"医美过度案例 / 苹果肌膨胀 / 微笑重建手术前后对比图所引出的'加工痕迹'讨论",
        "visualKeywords":["医美","填充","苹果肌","僵硬","加工痕迹","过度"],
        "socialIssue":"医美工业对身体自然感的批量改写 / 美型可见性的商品化",
        "systemLanguage":"加工痕迹脸 / 美型可见脸 / 表情冻结脸",
        "mappedFields":{"risk_value":"观察对象"},
        "queries":["botox face before after","plastic surgery face before after"],
        "must_have":["before","surgery","botox","reconstruct"],
        "allowUrls":[],
    },
    {
        "sampleId":"M07","branch":"modern",
        "type":"自然感商品化 / 低痕迹审美",
        "sampleName":"妈生感脸",
        "personOrSource":"'妈生鼻''妈生感美女'美妆医美内容 / 自然审美伪装",
        "faceType":"妈生感脸 / 自然伪装脸",
        "realCase":"'妈生鼻'、'妈生感美女'美妆营销 / 医美术后追求'天生感' / 自然伪装的低痕迹加工",
        "visualKeywords":["自然","低痕迹","妈生","天然感","伪装"],
        "socialIssue":"'自然感'本身成为可商品化标签 / 医美的'去医美化'自反性",
        "systemLanguage":"自然伪装脸 / 低痕迹加工脸 / 无修饰表演脸",
        "mappedFields":{"relationship_value":"不可判定但已配对"},
        "queries":["natural beauty face minimal makeup","妈生感"],
        "must_have":["natural","beauty","妈生"],
        "allowUrls":[],
    },
    {
        "sampleId":"M08","branch":"modern",
        "type":"疲惫感 / 女性年龄规训",
        "sampleName":"苦相脸",
        "personOrSource":"网络对疲惫女性 / 中年女性 / 综艺人物的攻击性说法",
        "faceType":"苦相脸 / 阶层疲惫脸",
        "realCase":"'苦相'作为网络攻击性外貌标签 / '看你一脸苦相'公共言论 / 对中年女性的外貌惩罚",
        "visualKeywords":["疲惫","法令纹","下垂","阶层","攻击性标签"],
        "socialIssue":"对女性年龄与生活状态的外貌惩罚 / '苦相'作为阶级与命运归因",
        "systemLanguage":"阶层疲惫脸 / 命运感过载脸 / 被生活解释脸",
        "mappedFields":{"income_value":"不可判定但已估算","risk_value":"观察对象"},
        "queries":["Resting bitch face example","tired worker face"],
        "must_have":["bitch","resting","tired","exhaust"],
        "allowUrls":[],
    },
    {
        "sampleId":"M09","branch":"modern",
        "type":"劳动损耗 / 职场压榨",
        "sampleName":"班味脸",
        "personOrSource":"打工人通勤照 / 职场平台'班味'讨论 / 过劳死（karoshi）议题",
        "faceType":"班味脸 / 劳动打磨脸",
        "realCase":"日本过劳死（karoshi）抗议 / 中国社交平台'打工人'、'班味'讨论 / 通勤照的劳动视觉",
        "visualKeywords":["打工人","通勤","过劳","体力透支","班味","劳动痕迹"],
        "socialIssue":"劳动对身体的损耗 / 职场过劳与身体商品化 / '班味'作为劳动压迫的视觉化",
        "systemLanguage":"劳动打磨脸 / 通勤损耗脸 / 被工作吞没脸",
        "mappedFields":{"income_value":"不可判定但已估算"},
        "queries":["karoshi","office worker tired"],
        "must_have":["karoshi","worker","office"],
        "allowUrls":[],
    },
    {
        "sampleId":"M10","branch":"modern",
        "type":"女性婚恋规训 / 家庭审美",
        "sampleName":"好嫁风脸",
        "personOrSource":"好嫁风妆造 / 穿搭博主 / 婚恋市场审美模板",
        "faceType":"好嫁风脸 / 适婚规训脸",
        "realCase":"'好嫁风'妆容穿搭博主 / 婚恋平台'适婚'标签 / 适婚化的女性身体与面容规训",
        "visualKeywords":["适婚","温柔","低攻击","亲和","婚恋市场","规训"],
        "socialIssue":"婚恋市场对女性面容与身体的'适婚'规训",
        "systemLanguage":"适婚规训脸 / 低威胁亲密脸 / 家庭友好脸",
        "mappedFields":{"family_value":"核心家庭","relationship_value":"稳定同居"},
        "queries":["Yamato Nadeshiko","Japanese bride portrait traditional"],
        "must_have":["bride","nadeshiko","japanese","traditional"],
        "allowUrls":[],
    },
    {
        "sampleId":"M11","branch":"modern",
        "type":"冷淡商品化 / 情绪商品",
        "sampleName":"厌世脸",
        "personOrSource":"小松菜奈类冷感表情 / 演员常被用作参照的厌世脸图像",
        "faceType":"厌世脸 / 情绪商品脸",
        "realCase":"小松菜奈被广泛用作'厌世脸'范本 / 冷淡表情作为情绪商品 / 疏离感的视觉美学化",
        "visualKeywords":["厌世","冷淡","疏离","低情绪","冷感","不想营业"],
        "socialIssue":"冷淡表情被商品化 / 疏离感作为可出售情绪",
        "systemLanguage":"情绪商品脸 / 冷感可出售脸 / 疏离审美脸",
        "mappedFields":{"sexuality_value":"不可判定但已归类"},
        "queries":["Komatsu Nana"],
        "must_have":["komatsu","nana"],
        "allowUrls":[],
    },
    {
        "sampleId":"M12","branch":"modern",
        "type":"政治表演 / 民粹传播",
        "sampleName":"政治表演脸 / 强势领导脸",
        "personOrSource":"特朗普公开演讲 / 竞选 / 媒体照片",
        "faceType":"政治表演脸 / 强势领导脸",
        "realCase":"特朗普竞选集会 / 总统官方照 / 民粹表演的政治表情模板",
        "visualKeywords":["政治表演","强势","民粹","情绪放大","夸张口型","权力表情"],
        "socialIssue":"民粹传播中的政治表情 / 公众情绪被表演化放大",
        "systemLanguage":"权力表演脸 / 民粹动员脸 / 公众情绪放大脸",
        "mappedFields":{"risk_value":"观察对象"},
        "queries":["Donald Trump campaign speech","Donald Trump rally"],
        "must_have":["trump","campaign","rally"],
        "allowUrls":[],
    },
]

# =================== helpers ===================

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

def commons_search(q, limit=8):
    url = "https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode({
        "action": "query", "format": "json", "list": "search",
        "srnamespace": "6", "srsearch": q, "srlimit": str(limit),
    })
    data = http_get_json(url)
    if not data: return []
    titles = [x["title"] for x in data.get("query", {}).get("search", [])]
    return [t for t in titles if any(t.lower().endswith(e) for e in [".jpg",".jpeg",".png"])]

def commons_imageinfo(titles):
    if not titles: return []
    url = "https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode({
        "action": "query", "format": "json", "prop": "imageinfo",
        "iiprop": "url|extmetadata", "iiurlwidth": "960",
        "titles": "|".join(titles),
    })
    data = http_get_json(url)
    if not data: return []
    out = []
    for p in data.get("query", {}).get("pages", {}).values():
        ii = p.get("imageinfo", [{}])[0]
        meta = ii.get("extmetadata") or {}
        out.append({
            "title": p.get("title", ""),
            "thumburl": ii.get("thumburl"),
            "url": ii.get("url"),
            "pageurl": ii.get("descriptionurl"),
            "license": meta.get("LicenseShortName", {}).get("value", ""),
        })
    return out

def download(url, dest, referer=None):
    import gzip
    headers = {"User-Agent": UA, "Accept": "image/*,*/*;q=0.8"}
    if referer:
        headers["Referer"] = referer
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=60) as r:
        data = r.read()
        if r.headers.get("Content-Encoding") == "gzip":
            data = gzip.decompress(data)
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    with open(dest, "wb") as f:
        f.write(data)
    return len(data)

def slugify(s):
    return re.sub(r"[^A-Za-z0-9]+", "_", s).strip("_").lower()[:40] or "sample"

# =================== 处理每个样本 ===================

def resolve_image(s):
    """按优先级找一张合适的图（语言/语义都强匹配）。"""
    # 1) 直接尝试 allowUrls（手动指定）
    for u in s.get("allowUrls", []):
        return u
    # 2) Wikipedia lead image（首选，因为语义匹配）
    # 优先中文 wiki
    for lang, q in [(la, qq) for la, qs in [("zh", [q for q in s["queries"] if any('\u4e00' <= c <= '\u9fff' for c in q)]), ("en", s["queries"])] for qq in qs]:
        try:
            url = page_lead(lang, qq)
            if url:
                return url
        except Exception:
            pass
        time.sleep(0.4)
    # 3) commons image search（带 must_have 过滤）
    for q in s["queries"]:
        titles = commons_search(q, limit=10)
        if not titles: continue
        info = commons_imageinfo(titles[:6])
        must = s.get("must_have") or []
        for item in info:
            tlow = item["title"].lower()
            if must and not any(m.lower() in tlow for m in must):
                continue
            if item.get("thumburl"):
                return item["thumburl"]
        time.sleep(0.5)
    return None

def process(s):
    sid = s["sampleId"]
    print(f"\n[{sid}] {s['sampleName']} …")
    slug = slugify(s["personOrSource"])
    main_dest = os.path.join(ROOT, "assets", "sample-library", "modern", f"{sid}_{slug}_main.jpg")
    result = dict(s)
    result["mainImage"] = None
    result["altImage"] = None
    result["sourceUrl"] = None
    result["altSourceUrl"] = None
    result["sourceNote"] = None
    result["visualKeywords"] = s.get("visualKeywords", [])
    result["status"] = "missing"

    url = resolve_image(s)
    if not url:
        print(f"  [MISS] {sid} no semantic-match image")
        return result
    try:
        ref = "https://commons.wikimedia.org/" if "wikimedia" in url else "https://en.wikipedia.org/"
        n = download(url, main_dest, referer=ref)
        result["mainImage"] = os.path.relpath(main_dest, ROOT).replace("\\", "/")
        # 找 sourceUrl：反推 page
        for lang, q in [("zh", s["queries"][0])] + [("en", qq) for qq in s["queries"]]:
            url_page = f"https://{'zh.wikipedia.org' if lang=='zh' else 'en.wikipedia.org'}/wiki/{q.replace(' ','_')}"
            result["sourceUrl"] = url_page
            break
        result["sourceNote"] = "Wikimedia Commons / Wikipedia (Public archive)"
        result["status"] = "ok"
        print(f"  OK {n}B  -> {main_dest}")
    except Exception as e:
        print(f"  [DL ERR] {sid}: {e}")
        result["status"] = "download_failed"
    return result

def main():
    out_dir = os.path.join(ROOT, "assets", "sample-library")
    # 读现有 manifest
    mp = os.path.join(out_dir, "sample_images_manifest.json")
    m = json.load(open(mp, encoding="utf-8"))
    # 移除所有 modern 段
    m["samples"] = [s for s in m["samples"] if s.get("branch") != "modern"]
    # 处理新 12 个
    new_modern = []
    for s in SAMPLES:
        r = process(s)
        new_modern.append(r)
        time.sleep(1.0)
    m["samples"].extend(new_modern)
    # 排序：branch, id
    order_branch = {"ancient": 0, "modern": 1, "western": 2}
    m["samples"].sort(key=lambda x: (order_branch.get(x.get("branch"), 9), x.get("sampleId", "")))
    with open(mp, "w", encoding="utf-8") as f:
        json.dump(m, f, ensure_ascii=False, indent=2)
    print(f"\n[MANIFEST] {mp}")
    ok = sum(1 for s in new_modern if s.get("status") == "ok")
    miss = [s["sampleId"] for s in new_modern if s.get("status") != "ok"]
    print(f"[SUMMARY modern] {ok}/12 OK · missing: {miss}")

if __name__ == "__main__":
    main()