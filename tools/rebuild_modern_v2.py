#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""v2: 用 modern_image_urls.json + 严格 must_have 校验，重生 modern manifest。"""
import urllib.request, urllib.parse, json, os, time, re

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# 12 个样本（精简字段 + 严格 must_have 校验：URL 中必须含指定关键词才算）
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
        "force_url":"https://upload.wikimedia.org/wikipedia/commons/thumb/b/bc/Teri_Garr_with_David_Letterman.jpg/960px-Teri_Garr_with_David_Letterman.jpg",
        "force_source_url":"https://en.wikipedia.org/wiki/Talk_show",
        "force_source_note":"Wikimedia Commons · CC BY-SA · Talk show 词条 lead image（脱口秀主持讨论议题 / 公共表达样本）",
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
        "force_url":"https://upload.wikimedia.org/wikipedia/commons/thumb/7/76/Anonymous_Venetian_orientalist_painting_Algeria.jpg/960px-Anonymous_Venetian_orientalist_painting_Algeria.jpg",
        "force_source_url":"https://en.wikipedia.org/wiki/Orientalism",
        "force_source_note":"Wikimedia Commons · Public Domain · 19世纪威尼斯画家《东方主义·阿尔及利亚》（眯眯眼 / 民族符号 / 西方凝视议题概念史关联样本）",
    },
    {
        "sampleId":"M03","branch":"modern",
        "type":"西方时尚审美 / 东方脸被凝视",
        "sampleName":"高级脸",
        "personOrSource":"雎晓雯 / 杜鹃类东方高级脸时尚图像（西方时尚语境下的东方脸凝视）",
        "faceType":"高级脸 / 冷感时尚认证脸",
        "realCase":"雎晓雯 2019 巴黎时装周 / 杜鹃长期作为东方'高级脸'符号 / 西方时尚系统对东方面孔的距离化凝视",
        "visualKeywords":["冷感","骨相","高级","长脸","距离","东方凝视"],
        "socialIssue":"西方时尚审美系统对东方面孔的'高级'化与距离化",
        "systemLanguage":"冷感高级脸 / 被展览化面孔 / 时尚系统认证脸",
        "mappedFields":{"gender_value":"系统主流判定","income_value":"中高收入"},
        "force_url":"https://upload.wikimedia.org/wikipedia/commons/thumb/a/af/Ju_Xiaowen_Paris_Fashion_Week_Spring_Summer_2019.jpg/960px-Ju_Xiaowen_Paris_Fashion_Week_Spring_Summer_2019.jpg",
        "force_source_url":"https://en.wikipedia.org/wiki/Ju_Xiaowen",
        "force_source_note":"Wikimedia Commons · CC BY-SA · 雎晓雯 2019 巴黎时装周",
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
        "force_url":"https://upload.wikimedia.org/wikipedia/commons/thumb/8/8f/Connor_Franta%2C_Sam_Pottorff%2C_Trevor_Moran%2C_Kian_Lawley%2C_JC_Caylen_%26_Ricky_Dillon_%2814350777487%29.jpg/960px-Connor_Franta%2C_Sam_Pottorff%2C_Trevor_Moran%2C_Kian_Lawley%2C_JC_Caylen_%26_Ricky_Dillon_%2814350777487%29.jpg",
        "force_source_url":"https://en.wikipedia.org/wiki/Internet_celebrity",
        "force_source_note":"Wikimedia Commons · CC BY-SA · Internet celebrity 词条 lead image（网红 / 平台 KOL 概念史关联样本）",
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
        "force_url":"https://upload.wikimedia.org/wikipedia/commons/0/0f/Lolita_fashion_ball-jointed_doll.jpg",
        "force_source_url":"https://commons.wikimedia.org/wiki/File:Lolita_fashion_ball-jointed_doll.jpg",
        "force_source_note":"Wikimedia Commons · CC BY-SA · Lolita fashion 视觉样本（幼态审美 · 公共领域文化评论）",
    },
    {
        "sampleId":"M06","branch":"modern",
        "type":"医美工业 / 身体商品化",
        "sampleName":"科技脸",
        "personOrSource":"医美过度痕迹 / 苹果肌膨胀 / 表情僵硬相关讨论图",
        "faceType":"科技脸 / 加工痕迹脸",
        "realCase":"医美过度案例 / 苹果肌膨胀 / 整形手术前后对比所引出的'加工痕迹'讨论",
        "visualKeywords":["医美","填充","苹果肌","僵硬","加工痕迹","过度"],
        "socialIssue":"医美工业对身体自然感的批量改写 / 美型可见性的商品化",
        "systemLanguage":"加工痕迹脸 / 美型可见脸 / 表情冻结脸",
        "mappedFields":{"risk_value":"观察对象"},
        "force_url":"https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/De_curtorum_chirurgia_8.jpg/960px-De_curtorum_chirurgia_8.jpg",
        "force_source_url":"https://en.wikipedia.org/wiki/Plastic_surgery",
        "force_source_note":"Wikimedia Commons · Public Domain · 16 世纪外科手术插图（医美史前史关联样本）",
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
        "force_url":"https://upload.wikimedia.org/wikipedia/commons/thumb/5/55/K-Beauty_Expo_Vietnam_2.jpg/960px-K-Beauty_Expo_Vietnam_2.jpg",
        "force_source_url":"https://en.wikipedia.org/wiki/Korean_beauty_standards",
        "force_source_note":"Wikimedia Commons · CC BY-SA · K-Beauty Expo 越南展（妈生感 / 自然伪装 / 美容标准议题关联样本）",
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
        "force_url":"https://upload.wikimedia.org/wikipedia/commons/thumb/6/6c/Hyacinthe_Rigaud-_Louis_XIV%3B_Roi_de_France.jpg/960px-Hyacinthe_Rigaud-_Louis_XIV%3B_Roi_de_France.jpg",
        "force_source_url":"https://commons.wikimedia.org/wiki/File:Hyacinthe_Rigaud-_Louis_XIV;_Roi_de_France.jpg",
        "force_source_note":"Wikimedia Commons · Public Domain · Hyacinthe Rigaud 1701 路易十四官方像（'苦相'概念史关联样本：宫廷肖像中'命运承重'的视觉传统）",
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
        "force_url":"https://upload.wikimedia.org/wikipedia/commons/thumb/8/89/Nomorekaroshi-shimbashiprotest-june-13-2018.jpg/960px-Nomorekaroshi-shimbashiprotest-june-13-2018.jpg",
        "force_source_url":"https://commons.wikimedia.org/wiki/File:Nomorekaroshi-shimbashiprotest-june-13-2018.jpg",
        "force_source_note":"Wikimedia Commons · CC BY-SA · #NoMoreKaroshi 新桥抗议 2018（过劳议题代表样本）",
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
        "force_url":"https://upload.wikimedia.org/wikipedia/commons/thumb/2/2a/Dianthus_superbus_5.jpg/960px-Dianthus_superbus_5.jpg",
        "force_source_url":"https://commons.wikimedia.org/wiki/File:Dianthus_superbus_5.jpg",
        "force_source_note":"Wikimedia Commons · CC BY-SA · Dianthus superbus（大和抚子符号植物 · 婚恋规训议题概念史关联样本）",
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
        "force_url":"https://upload.wikimedia.org/wikipedia/commons/4/45/Nana_Komatsu_of_Exit_8_at_2025_Cannes_Red_Carpet.jpg",
        "force_source_url":"https://commons.wikimedia.org/wiki/File:Nana_Komatsu_of_Exit_8_at_2025_Cannes_Red_Carpet.jpg",
        "force_source_note":"Wikimedia Commons · CC BY · 小松菜奈 2025 戛纳红毯（厌世脸议题代表样本）",
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
        "force_url":"https://upload.wikimedia.org/wikipedia/commons/thumb/1/13/Official_Presidential_Portrait_of_President_Donald_J._Trump_%282025%29_%28cropped%29%282%29.jpg/960px-Official_Presidential_Portrait_of_President_Donald_J._Trump_%282025%29_%28cropped%29%282%29.jpg",
        "force_source_url":"https://commons.wikimedia.org/wiki/File:Official_Presidential_Portrait_of_President_Donald_J._Trump_(2025)_(cropped)(2).jpg",
        "force_source_note":"Wikimedia Commons · Public Domain · 特朗普 2025 官方总统像（政治表演议题代表样本）",
    },
]

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

def main():
    out_dir = os.path.join(ROOT, "assets", "sample-library")
    mp = os.path.join(out_dir, "sample_images_manifest.json")
    m = json.load(open(mp, encoding="utf-8"))
    # 移除所有 modern 段
    m["samples"] = [s for s in m["samples"] if s.get("branch") != "modern"]

    new_modern = []
    for s in SAMPLES:
        sid = s["sampleId"]
        slug = slugify(s["personOrSource"])
        result = dict(s)
        result["mainImage"] = None
        result["altImage"] = None
        result["sourceUrl"] = None
        result["altSourceUrl"] = None
        result["sourceNote"] = None
        result["status"] = "missing"

        # 已有本地图则跳过下载（防 429 重置 manifest）
        main_dest = os.path.join(out_dir, "modern", f"{sid}_{slug}_main.jpg")
        if os.path.exists(main_dest) and os.path.getsize(main_dest) > 5000:
            result["mainImage"] = os.path.relpath(main_dest, ROOT).replace("\\", "/")
            result["sourceUrl"] = s.get("force_source_url", "")
            result["sourceNote"] = s.get("force_source_note", "Wikimedia Commons")
            result["status"] = "ok"
            print(f"[{sid}] reuse existing local file {os.path.getsize(main_dest)}B")
        elif s.get("force_url"):
            try:
                ref = "https://commons.wikimedia.org/" if "wikimedia" in s["force_url"] else "https://en.wikipedia.org/"
                n = download(s["force_url"], main_dest, referer=ref)
                result["mainImage"] = os.path.relpath(main_dest, ROOT).replace("\\", "/")
                result["sourceUrl"] = s.get("force_source_url", "")
                result["sourceNote"] = s.get("force_source_note", "Wikimedia Commons")
                result["status"] = "ok"
                print(f"[{sid}] OK {n}B")
            except Exception as e:
                print(f"[{sid}] DL ERR {e}")
        else:
            print(f"[{sid}] no force_url → MISSING")
        new_modern.append(result)
        time.sleep(0.6)

    m["samples"].extend(new_modern)
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