#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""专门为 modern 段生成 sample board：展示 faceType / realCase / socialIssue。"""
import json, os, html

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MANIFEST = os.path.join(ROOT, "assets", "sample-library", "sample_images_manifest.json")
OUT_DIR = os.path.join(ROOT, "_preview", "sample-library")
os.makedirs(OUT_DIR, exist_ok=True)

CSS_TEMPLATE = """
* {{ box-sizing: border-box; margin: 0; padding: 0; }}
body {{
  background: #050505; color: #f5f5f5;
  font-family: 'Courier New', 'SimHei', monospace;
  padding: 40px 20px; min-height: 100vh;
}}
header {{
  text-align: center; padding: 24px 12px 32px;
  border-bottom: 2px dashed #f5d400; margin-bottom: 32px;
}}
header .icon {{ font-size: 48px; margin-bottom: 8px; }}
header h1 {{
  font-size: 18px; letter-spacing: 4px; color: #f5d400;
  text-transform: uppercase; margin-bottom: 12px;
}}
header .sub {{ font-size: 12px; opacity: 0.7; letter-spacing: 2px; }}
header .meta {{ font-size: 10px; opacity: 0.4; margin-top: 8px; }}
.notice {{
  max-width: 1100px; margin: 0 auto 24px; padding: 12px 16px;
  background: #1a1a1a; border: 1px dashed #f5d400;
  font-size: 11px; letter-spacing: 1px; line-height: 1.6; opacity: 0.85;
}}
.grid {{
  max-width: 1200px; margin: 0 auto;
  display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 18px;
}}
.card {{
  background: #141414; border: 2px solid #f5d400;
  padding: 14px; position: relative;
}}
.card.missing {{ opacity: 0.5; border-style: dashed; }}
.card .sid {{
  position: absolute; top: 6px; right: 8px;
  font-size: 11px; color: #f5d400; font-weight: 900; letter-spacing: 2px;
}}
.card .face-type {{
  display: inline-block; font-size: 10px; color: #000;
  background: #f5d400; padding: 2px 6px;
  letter-spacing: 1.5px; margin-bottom: 6px; font-weight: 900;
  text-transform: uppercase;
}}
.card .img-wrap {{
  width: 100%; aspect-ratio: 4/3; background: #000;
  border: 1px solid #f5d400; overflow: hidden; margin-bottom: 10px;
  display: flex; align-items: center; justify-content: center;
}}
.card .img-wrap img {{ width: 100%; height: 100%; object-fit: cover; display: block; }}
.card .img-wrap .missing {{
  font-size: 11px; color: #f5d400; padding: 20px; text-align: center; line-height: 1.6;
}}
.card .name {{ font-size: 14px; color: #f5d400; font-weight: 900; margin-bottom: 4px; }}
.card .real-case {{ font-size: 11px; opacity: 0.85; margin-bottom: 8px; font-style: italic; line-height: 1.5; }}
.card .issue {{
  font-size: 11px; color: #d60000; margin-top: 6px;
  padding: 6px 8px; border-left: 3px solid #d60000;
  background: rgba(214, 0, 0, 0.05); line-height: 1.5;
}}
.card .keywords {{ display: flex; flex-wrap: wrap; gap: 4px; margin-top: 8px; }}
.card .kw {{
  font-size: 9px; padding: 2px 5px; border: 1px solid #f5d400;
  letter-spacing: 0.5px; opacity: 0.85;
}}
.card .sys-lang {{
  font-size: 10px; color: #f5d400; margin-top: 8px;
  padding-top: 6px; border-top: 1px dashed #f5d400; line-height: 1.4;
  opacity: 0.95;
}}
.card .src {{ font-size: 9px; opacity: 0.5; margin-top: 6px; word-break: break-all; }}
.card .src a {{ color: #f5d400; text-decoration: none; }}
.card .src a:hover {{ text-decoration: underline; }}
.card .fields {{
  font-size: 9px; opacity: 0.55; margin-top: 6px; font-family: monospace;
}}
footer {{
  text-align: center; margin-top: 40px; padding: 20px;
  font-size: 10px; opacity: 0.4; letter-spacing: 1px;
}}
"""

def render_card(s):
    sid = s.get("sampleId", "")
    name = html.escape(s.get("sampleName", ""))
    face_type = html.escape(s.get("faceType", ""))
    real_case = html.escape(s.get("realCase", ""))
    issue = html.escape(s.get("socialIssue", ""))
    sys_lang = html.escape(s.get("systemLanguage", ""))
    main = s.get("mainImage")
    src_url = s.get("sourceUrl", "")
    src_note = html.escape(s.get("sourceNote", "") or "")
    mapped = s.get("mappedFields", {})
    keywords = s.get("visualKeywords", []) or []
    status = s.get("status", "missing")
    cls = "card missing" if status != "ok" or not main else "card"

    if main:
        img_html = f'<img src="../../{main}" alt="{name}" loading="lazy" onerror="this.parentElement.innerHTML=\'<div class=missing>图 404</div>\'">'
    else:
        img_html = '<div class="missing">未找到符合<br>样本语义的<br>公开人脸图</div>'

    fields_html = ""
    if mapped:
        fields_html = '<div class="fields">fields: ' + ", ".join(
            f'{k}={html.escape(str(v))}' for k, v in mapped.items()
        ) + "</div>"

    keywords_html = ""
    if keywords:
        keywords_html = '<div class="keywords">' + "".join(
            f'<span class="kw">{html.escape(k)}</span>' for k in keywords
        ) + "</div>"

    src_html = ""
    if src_url:
        src_html = f'<div class="src">src: <a href="{html.escape(src_url)}" target="_blank" rel="noopener">{html.escape(src_url[:80])}</a></div>'
    if src_note:
        src_html += f'<div class="src">note: {src_note}</div>'

    return f'''<div class="{cls}">
  <div class="sid">{sid}</div>
  <div class="face-type">{face_type}</div>
  <div class="img-wrap">{img_html}</div>
  <div class="name">{name}</div>
  <div class="real-case">CASE: {real_case}</div>
  {keywords_html}
  <div class="issue">⚠ ISSUE: {issue}</div>
  <div class="sys-lang">→ SYSTEM: {sys_lang}</div>
  {fields_html}
  {src_html}
</div>'''

def main():
    m = json.load(open(MANIFEST, encoding="utf-8"))
    modern_samples = [s for s in m["samples"] if s.get("branch") == "modern"]
    modern_samples.sort(key=lambda x: x.get("sampleId", ""))
    if not modern_samples:
        print("no modern samples")
        return
    cards = "\n".join(render_card(s) for s in modern_samples)
    ok = sum(1 for s in modern_samples if s.get("status") == "ok" and s.get("mainImage"))
    notice = f"⚠ 本板为研究用样本库（{ok}/{len(modern_samples)} 已找到本地图像）· 主题：当代社会议题 · 公共舆论 · 平台审美 · 身份判断 · 不接入正式作品流程"
    css = CSS_TEMPLATE.format()
    html_doc = f'''<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>BIAS SYSTEM · 现代归类样本库 · CONTEMPORARY ISSUE FACE LIBRARY</title>
<style>{css}</style>
</head>
<body>
<header>
  <div class="icon">📱</div>
  <h1>BIAS SYSTEM · 现代归类样本库 · CONTEMPORARY ISSUE FACE LIBRARY</h1>
  <div class="sub">12 样本 / 6 类型 × 每类 2 / 当代社会议题 · 公共舆论 · 平台审美 · 身份判断</div>
  <div class="meta">BIAS SYSTEM · SAMPLE LIBRARY v03 · MODERN BRANCH</div>
</header>
<div class="notice">{notice}</div>
<div class="grid">
{cards}
</div>
<footer>BIAS SYSTEM · SAMPLE LIBRARY v03 · 仅供研究预览 · 不接 AI · 不接摄像头 · 不接 pathSelect · 不替代娱乐圈审美分类</footer>
</body>
</html>
'''
    out = os.path.join(OUT_DIR, "modern_sample_board.html")
    with open(out, "w", encoding="utf-8") as f:
        f.write(html_doc)
    print(f"  -> {out} ({ok}/{len(modern_samples)} OK)")

if __name__ == "__main__":
    main()