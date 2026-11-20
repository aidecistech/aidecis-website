"""PDF twin of each news article (news/<slug>.pdf), in Aidecis house style.

Reads the headline (h1) and the article body (<article class="news-article">) from news/<slug>.html and writes an A4 PDF
with ReportLab: teal top band, logo and running header, serif headlines, Inter body text, footer tagline and page number.
The layout copies the PDFs published in October 2026. Gelasio Bold stands in for Georgia Bold (same metrics); both
fonts are in scripts/news/fonts (SIL Open Font License).

Usage, from the repository root:
    python3 scripts/news/build_pdf.py                 # every article
    python3 scripts/news/build_pdf.py <slug> [...]    # only these, e.g. oracle-ebs-supply-chain-decision-intelligence
Needs reportlab (pip install reportlab)."""
import re
import sys
from html import escape, unescape
from pathlib import Path

from reportlab.lib.colors import Color
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Frame, PageTemplate, BaseDocTemplate, Paragraph

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
NEWS = ROOT / 'news'

DEEP = Color(0.05098, 0.247059, 0.321569)      # #0D3F52
TEAL = Color(0.101961, 0.349020, 0.450980)     # #1A5973
MUTED = Color(0.368627, 0.462745, 0.509804)    # #5E7682
RULE = Color(0.827451, 0.866667, 0.882353)     # #D3DDE1

HEADER = 'AIDECIS NEWS · SUPPLY-CHAIN DECISION INTELLIGENCE'
TAGLINE = 'Authority before autonomy  ·  Evidence follows the action  ·  Learn within governed boundaries  ·  aidecis.com'
LEFT, WIDTH = 20 * mm, 170 * mm
TOP, BOTTOM = 27 * mm, 25 * mm

pdfmetrics.registerFont(TTFont('Inter-Regular', str(HERE / 'fonts' / 'Inter-Regular.ttf')))
pdfmetrics.registerFont(TTFont('Georgia-Bold', str(HERE / 'fonts' / 'Gelasio-Bold.ttf')))

TITLE = ParagraphStyle('title', fontName='Georgia-Bold', fontSize=24, leading=28, textColor=DEEP, spaceAfter=12.669)
H2 = ParagraphStyle('h2', fontName='Georgia-Bold', fontSize=15, leading=19, textColor=DEEP, spaceBefore=17, spaceAfter=6,
                    keepWithNext=1)
BODY = ParagraphStyle('body', fontName='Inter-Regular', fontSize=9.7, leading=13.6, textColor=DEEP, spaceAfter=6.5)
BULLET = ParagraphStyle('bullet', parent=BODY, leftIndent=13, firstLineIndent=-9, spaceAfter=2)
SMALL = ParagraphStyle('small', fontName='Inter-Regular', fontSize=8.5, leading=12, textColor=MUTED, spaceBefore=14)


def text(fragment):
    """Visible text of an HTML fragment, escaped for ReportLab's paragraph markup."""
    return escape(re.sub(r'\s+', ' ', unescape(re.sub(r'<[^>]+>', '', fragment))).strip(), quote=False)


def story(html):
    headline = text(re.search(r'<h1>(.*?)</h1>', html, re.S).group(1))
    body = re.search(r'<article class="news-article">(.*?)</article>', html, re.S).group(1)
    flow = [Paragraph(headline, TITLE)]
    for tag, inner in re.findall(r'<(h2|p|ul|ol)>(.*?)</\1>', body, re.S):
        if tag == 'h2':
            flow.append(Paragraph(text(inner), H2))
        elif tag == 'p':
            flow.append(Paragraph(text(inner), BODY))
        else:
            for item in re.findall(r'<li>(.*?)</li>', inner, re.S):
                flow.append(Paragraph('• ' + text(item), BULLET))
    flow.append(Paragraph('Copyright 2026 Aidecis', SMALL))
    return unescape(headline), flow


def decorate(canvas, doc):
    w, h = A4
    canvas.saveState()
    canvas.setFillColor(TEAL)
    canvas.rect(0, h - 3 * mm, w, 3 * mm, stroke=0, fill=1)
    canvas.drawImage(str(HERE / 'news-logo.jpg'), LEFT, 782.3208, width=88.0992, height=39.56736)
    canvas.setFillColor(MUTED)
    canvas.setFont('Inter-Regular', 7.5)
    canvas.drawRightString(LEFT + WIDTH, 800.1237, HEADER)
    canvas.setStrokeColor(RULE)
    canvas.setLineWidth(0.6)
    canvas.line(LEFT, 41.88977, LEFT + WIDTH, 41.88977)
    canvas.setFont('Inter-Regular', 7.2)
    canvas.drawString(LEFT, 27.88977, TAGLINE)
    canvas.drawRightString(LEFT + WIDTH, 27.88977, str(doc.page))
    canvas.restoreState()


def build(slug):
    html = (NEWS / f'{slug}.html').read_text()
    headline, flow = story(html)
    out = NEWS / f'{slug}.pdf'
    doc = BaseDocTemplate(str(out), pagesize=A4, title=headline, author='Aidecis',
                          leftMargin=LEFT, rightMargin=A4[0] - LEFT - WIDTH, topMargin=TOP, bottomMargin=BOTTOM)
    frame = Frame(LEFT, BOTTOM, WIDTH, A4[1] - TOP - BOTTOM, id='body')
    doc.addPageTemplates([PageTemplate(id='page', frames=[frame], onPage=decorate)])
    doc.build(flow)
    return out, doc.page


if __name__ == '__main__':
    slugs = sys.argv[1:] or sorted(p.stem for p in NEWS.glob('*.html'))
    for slug in slugs:
        out, pages = build(slug)
        print(f'{out.relative_to(ROOT)}: {pages} page{"s" if pages != 1 else ""}')
