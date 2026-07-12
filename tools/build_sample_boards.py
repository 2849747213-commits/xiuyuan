#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""根据 sample_images_manifest.json 生成三张样本板 HTML."""
import json, os, html

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MANIFEST = os.path.join(ROOT, "assets", "sample-library", "sample_images_manifest.json")
OUT_DIR = os.path.join(ROOT, "_preview", "sample-library")
os.makedirs(OUT_DIR, exist_ok=True)

BOARD_THEME = {
    "ancient": {
        "title": "BIAS SYSTEM · 古代面学样本库 · ANCIENT PHYSIOGNOMY SAMPLE LIBRARY",
        "subtitle": "12 个样本 / 6 类型 × 每类 2 / 中国古代相书语境",
        "css_bg": "#1a0f08", "css_panel": "#2a1a10", "css_border": "#8b3a2a",
        "css_accent": "#d4a574", "css_text": "#e8d4b8",
        "icon": "🏛",
    },
    "modern": {
        "title": "BIAS SYSTEM · 现代归类样本库 · MODERN CLASSIFICATION SAMPLE LIBRARY",
        "subtitle": "12 个样本 / 6 类型 × 每类 2 / 中外当代名人平台归类语境",
        "css_bg": "#0a0a0a", "css_panel": "#1a1a1a", "css_border": "#f5d400",
        "css_accent": "#f5d400", "css_text": "#ffffff",
        "icon": "📱",
    },
    "western": {
        "title": "BIAS SYSTEM · 西方面学样本库 · WESTERN PHYSIOGNOMIC ARCHIVE",
        "subtitle": "12 个样本 / 6 类型 × 每类 2 / 西方旧档案 / Bertillon / Lavater / Galton / Lombroso",
        "css_bg": "#181818", "css_panel": "#1f1f1f", "css_border": "#5a5a5a",
        "css_accent": "#8a1a1a", "css_text": "#ece8db",
        "icon": "📜",
    },
}

CSS_TEMPLATE = """
* {{ box-sizing: border-box; margin: 0; padding: 0; }}
body {{
  background: {bg}; color: {text}; font-family: 'Courier New', 'SimHei', monospace;
  padding: 40px 20px; min-height: 100vh;
}}
header {{
  text-align: center; padding: 24px 12px 32px;
  border-bottom: 2px dashed {border}; margin-bottom: 32px;
}}
header .icon {{ font-size: 48px; margin-bottom: 8px; }}
header h1 {{
  font-size: 18px; letter-spacing: 4px; color: {accent};
  text-transform: uppercase; margin-bottom: 12px;
}}
header .sub {{ font-size: 12px; color: {text}; opacity: 0.7; letter-spacing: 2px; }}
header .meta {{ font-size: 10px; color: {text}; opacity: 0.4; margin-top: 8px; }}
.notice {{
  max-width: 1100px; margin: 0 auto 24px; padding: 12px 16px;
  background: {panel}; border: 1px dashed {border};
  font-size: 11px; letter-spacing: 1px; line-height: 1.6;
  color: {text}; opacity: 0.85;
}}
.grid {{
  max-width: 1200px; margin: 0 auto;
  display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 18px;
}}
.card {{
  background: {panel}; border: 2px solid {border};
  padding: 14px; position: relative;
}}
.card.missing {{ opacity: 0.5; border-style: dashed; }}
.card .sid {{
  position: absolute; top: 6px; right: 8px;
  font-size: 11px; color: {accent}; font-weight: 900; letter-spacing: 2px;
}}
.card .type {{
  font-size: 10px; color: {accent}; letter-spacing: 1.5px; margin-bottom: 6px;
  text-transform: uppercase;
}}
.card .img-wrap {{
  width: 100%; aspect-ratio: 4/3; background: #000;
  border: 1px solid {border}; overflow: hidden; margin-bottom: 10px;
  display: flex; align-items: center; justify-content: center;
}}
.card .img-wrap img {{ width: 100%; height: 100%; object-fit: cover; display: block; }}
.card .img-wrap .alt {{ font-size: 10px; color: {accent}; opacity: 0.5; }}
.card .img-wrap .missing {{ font-size: 11px; color: {accent}; padding: 20px; text-align: center; }}
.card .name {{ font-size: 14px; color: {accent}; font-weight: 900; margin-bottom: 4px; }}
.card .person {{ font-size: 11px; opacity: 0.85; margin-bottom: 8px; font-style: italic; }}
.card .sys-lang {{
  font-size: 11px; color: {accent}; margin-top: 8px; padding-top: 8px;
  border-top: 1px dashed {border}; line-height: 1.5; opacity: 0.95;
}}
.card .src {{ font-size: 9px; opacity: 0.5; margin-top: 6px; }}
.card .src a {{ color: {accent}; text-decoration: none; }}
.card .src a:hover {{ text-decoration: underline; }}
.card .keywords {{
  display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px;
}}
.card .kw {{
  font-size: 9px; padding: 2px 5px; border: 1px solid {border};
  letter-spacing: 0.5px; color: {text}; opacity: 0.8;
}}
.card .fields {{
  font-size: 9px; opacity: 0.55; margin-top: 6px; font-family: monospace;
}}
footer {{
  text-align: center; margin-top: 40px; padding: 20px;
  font-size: 10px; opacity: 0.4; letter-spacing: 1px;
}}
"""

def render_card(s, theme):
    sid = s["sampleId"]
    name = html.escape(s.get("sampleName", ""))
    typ = html.escape(s.get("type", ""))
    person = html.escape(s.get("personOrSource", ""))
    sys_lang = html.escape(s.get("systemLanguage", ""))
    main = s.get("mainImage")
    alt = s.get("altImage")
    src_url = s.get("sourceUrl", "")
    src_note = html.escape(s.get("sourceNote", "") or "")
    mapped = s.get("mappedFields", {})
    status = s.get("status", "missing")
    cls = "card missing" if status != "ok" or not main else "card"

    if main:
        # 转绝对路径为 file:// 协议（dev 用），但 _preview 是被浏览器直接打开的
        # 这里用相对路径，相对于 _preview/sample-library/ 文件
        img_html = f'<img src="../../{main}" alt="{name}" loading="lazy" onerror="this.parentElement.innerHTML=\'<div class=missing>图 404</div>\'">'
    else:
        img_html = '<div class="missing">未找到公开图像<br>(commons / wiki 无图)</div>'

    fields_html = ""
    if mapped:
        fields_html = '<div class="fields">fields: ' + ", ".join(
            f'{k}={html.escape(str(v))}' for k, v in mapped.items()
        ) + "</div>"

    keywords_html = ""  # 没有 visualKeywords 字段，先不写

    src_html = ""
    if src_url:
        src_html = f'<div class="src">src: <a href="{html.escape(src_url)}" target="_blank" rel="noopener">{html.escape(src_url[:80])}</a> · {src_note}</div>'

    return f'''<div class="{cls}">
  <div class="sid">{sid}</div>
  <div class="type">{typ}</div>
  <div class="img-wrap">{img_html}</div>
  <div class="name">{name}</div>
  <div class="person">{person}</div>
  <div class="sys-lang">→ {sys_lang}</div>
  {fields_html}
  {src_html}
</div>'''

def render_board(branch, samples, theme):
    cards = "\n".join(render_card(s, theme) for s in samples)
    css = CSS_TEMPLATE.format(
        bg=theme["css_bg"], panel=theme["css_panel"], border=theme["css_border"],
        accent=theme["css_accent"], text=theme["css_text"],
    )
    ok = sum(1 for s in samples if s.get("status") == "ok" and s.get("mainImage"))
    notice = f"⚠ 本板为研究用样本库（{ok}/{len(samples)} 已找到本地图像）· 不接入正式作品流程 · 所有图像来自 Wikimedia Commons / Wikipedia 公开存档"
    html_doc = f'''<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{theme["title"]}</title>
<style>{css}</style>
</head>
<body>
<header>
  <div class="icon">{theme["icon"]}</div>
  <h1>{theme["title"]}</h1>
  <div class="sub">{theme["subtitle"]}</div>
  <div class="meta">BIAS SYSTEM · SAMPLE LIBRARY v03 · {branch.upper()} BRANCH</div>
</header>
<div class="notice">{notice}</div>
<div class="grid">
{cards}
</div>
<footer>BIAS SYSTEM · SAMPLE LIBRARY v03 · 仅供研究预览 · 不接 AI · 不接摄像头 · 不接 pathSelect</footer>
</body>
</html>
'''
    out = os.path.join(OUT_DIR, f"{branch}_sample_board.html")
    with open(out, "w", encoding="utf-8") as f:
        f.write(html_doc)
    print(f"  -> {out} ({ok}/{len(samples)} OK)")

def main():
    m = json.load(open(MANIFEST, encoding="utf-8"))
    by_branch = {}
    for s in m["samples"]:
        by_branch.setdefault(s["branch"], []).append(s)
    for branch in ["ancient", "modern", "western"]:
        samples = by_branch.get(branch, [])
        if not samples:
            print(f"  no samples for {branch}")
            continue
        render_board(branch, samples, BOARD_THEME[branch])

if __name__ == "__main__":
    main()