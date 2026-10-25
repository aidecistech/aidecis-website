# Search and AI findability

How aidecis.com is set up for search engines and AI assistants, and the keywords it targets.

## Keyword plan (October 2026)

Benchmark: Aera Technology positions itself as "The Decision Intelligence Company" with "Agentic Decision Intelligence", "governed execution" and "human-in-the-loop". o9, Kinaxis and Peak use "AI-powered planning", "supply chain management" and "agentic AI". Aidecis does not compete on planning; it competes on who may decide and what evidence follows.

| Priority | Keyword cluster | Main page |
|---|---|---|
| 1 | supply-chain decision intelligence, decision intelligence platform | Home |
| 1 | decision accountability, supply-chain decision governance | Home, Accountability |
| 2 | AI agent governance in supply chains, governing bots and AI agents, human-in-the-loop approval | Home |
| 2 | delegation of authority, approval limits, audit trail for supply-chain decisions | Accountability, Use cases |
| 3 | use-case terms: expedite freight, inventory reallocation, supplier disruption, quality hold, PO exception, invoice variance | Use cases |
| 3 | industry long tail: "<industry> supply-chain decision intelligence" | Industry pages |
| 3 | business case / ROI for decision intelligence | Benefits |

Rules: one primary cluster per page; the title starts with the keyword and ends with "| Aidecis"; descriptions are 70–160 characters, state what the page offers, and make no claim the page itself does not make.

## What is in place

- Title, meta description, canonical URL (www.aidecis.com), Open Graph and Twitter tags on every public page.
- JSON-LD on every page: Organization, WebSite, WebPage, BreadcrumbList; SoftwareApplication on the home page; ItemList on Use cases and Industries.
- `sitemap.xml` with `lastmod`; `robots.txt` allows all crawlers and names the AI crawlers explicitly.
- `llms.txt`: a plain summary of Aidecis and its pages for language models.
- Spanish and Dutch titles and descriptions in `assets/seo-translations.js` (switched by the language selector).

Change titles or descriptions in `scripts/seo/build_seo.py`, add the translations, run the script and `python3 -m unittest tests.test_seo`.

## Not yet done

- The Spanish and Dutch texts exist only after JavaScript runs on the same URL. For ranking in Dutch and Spanish, separate static pages (`/nl/`, `/es/`) with `hreflang` links are needed.
- aidecis.com and www.aidecis.com both serve the site without a redirect. The canonical tags point to www; a permanent 301 redirect from aidecis.com to www.aidecis.com in TransIP removes the duplicate.
- Google Search Console and Bing Webmaster Tools: verify the domain and submit the sitemap.
