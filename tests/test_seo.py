"""Search and AI-crawler basics for every page in the sitemap: title, description, canonical, social tags, JSON-LD
and Spanish/Dutch versions of the title and description."""

import json
import re
import subprocess
import unittest
from html import unescape
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = "https://www.aidecis.com/"


def head_value(html, pattern):
    match = re.search(pattern, html, re.S)
    return unescape(match.group(1)) if match else None


def translations():
    """The translation catalog as site.js sees it, built by running the translation files in Node when available."""
    files = ["translations.js", "proposal-translations.js", "brand-refresh-translations.js", "site-copy-editorial.js", "seo-translations.js"]
    script = "global.window={};" + "".join(f"require({json.dumps(str(ROOT / 'assets' / f))});" for f in files) + \
             "process.stdout.write(JSON.stringify(window.AIDECIS_TRANSLATIONS))"
    try:
        return json.loads(subprocess.run(["node", "-e", script], check=True, capture_output=True, text=True).stdout)
    except (FileNotFoundError, subprocess.CalledProcessError):
        return None


class SeoTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        sitemap = (ROOT / "sitemap.xml").read_text()
        cls.urls = re.findall(r"<loc>(.*?)</loc>", sitemap)
        cls.pages = {url: (ROOT / ("index.html" if url == BASE else url[len(BASE):])).read_text() for url in cls.urls}

    def test_sitemap_lists_every_public_page_with_lastmod(self):
        listed = {("index.html" if u == BASE else u[len(BASE):]) for u in self.urls}
        self.assertEqual(listed, {p.name for p in ROOT.glob("*.html")} | {"news/" + p.name for p in ROOT.glob("news/*.html")})
        self.assertEqual(len(re.findall(r"<lastmod>\d{4}-\d{2}-\d{2}</lastmod>", (ROOT / "sitemap.xml").read_text())), len(self.urls))

    def test_each_page_has_unique_title_description_and_canonical(self):
        titles, descriptions = set(), set()
        for url, html in self.pages.items():
            with self.subTest(url=url):
                title = head_value(html, r"<title>(.*?)</title>")
                desc = head_value(html, r'<meta name="description" content="([^"]*)"')
                self.assertTrue(title and desc)
                self.assertLessEqual(len(desc), 160, desc)
                self.assertGreaterEqual(len(desc), 70, desc)
                self.assertNotIn(title, titles)
                self.assertNotIn(desc, descriptions)
                titles.add(title); descriptions.add(desc)
                self.assertEqual(head_value(html, r'<link rel="canonical" href="([^"]*)"'), url)
                self.assertEqual(head_value(html, r'<meta property="og:url" content="([^"]*)"'), url)
                self.assertEqual(head_value(html, r'<meta property="og:title" content="([^"]*)"'), title)
                self.assertEqual(html.count("<h1"), 1)

    def test_json_ld_is_valid_and_describes_the_page(self):
        for url, html in self.pages.items():
            with self.subTest(url=url):
                blocks = re.findall(r'<script type="application/ld\+json">(.*?)</script>', html, re.S)
                self.assertEqual(len(blocks), 1)
                graph = json.loads(blocks[0])["@graph"]
                types = {node["@type"] for node in graph}
                self.assertTrue({"Organization", "WebSite"} <= types)
                page = next(n for n in graph if n["@type"] in ("WebPage", "ContactPage"))
                self.assertEqual(page["url"], url)
                if url != BASE:
                    crumbs = next(n for n in graph if n["@type"] == "BreadcrumbList")["itemListElement"]
                    self.assertEqual(crumbs[-1]["item"], url)
                    self.assertEqual([c["position"] for c in crumbs], list(range(1, len(crumbs) + 1)))

    def test_titles_and_descriptions_have_spanish_and_dutch_versions(self):
        catalog = translations()
        if catalog is None:
            self.skipTest("Node is needed to read the translation files")
        for url, html in self.pages.items():
            if "/news/" in url:  # articles are published in English only
                continue
            for text in (head_value(html, r"<title>(.*?)</title>"), head_value(html, r'<meta name="description" content="([^"]*)"')):
                for language in ("es", "nl"):
                    with self.subTest(url=url, language=language, text=text[:40]):
                        self.assertIn(text, catalog[language])
            self.assertLess(html.index("assets/seo-translations.js"), html.index("assets/site.js"))

    def test_robots_and_llms_txt(self):
        robots = (ROOT / "robots.txt").read_text()
        self.assertIn("Sitemap: https://www.aidecis.com/sitemap.xml", robots)
        self.assertNotRegex(robots, r"(?m)^Disallow:\s*/\s*$")
        for bot in ("GPTBot", "OAI-SearchBot", "ClaudeBot", "PerplexityBot", "Google-Extended"):
            self.assertIn(f"User-agent: {bot}", robots)
        llms = (ROOT / "llms.txt").read_text()
        self.assertTrue(llms.startswith("# Aidecis\n"))
        for link in re.findall(r"\]\((https://www\.aidecis\.com/[^)]*)\)", llms):
            name = "index.html" if link == BASE else link[len(BASE):]
            self.assertTrue((ROOT / name).exists(), link)


if __name__ == "__main__":
    unittest.main()
