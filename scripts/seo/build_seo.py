"""SEO head for every public page: title, description, canonical, Open Graph/Twitter tags, JSON-LD and the sitemap.
Edit the titles and descriptions here, add their Spanish and Dutch versions to assets/seo-translations.js, then run
`python3 scripts/seo/build_seo.py` from the repository root and `python3 -m unittest tests.test_seo`. Idempotent: the
generated block sits between the seo:start and seo:end markers and is replaced on every run."""
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else '.')
BASE = 'https://www.aidecis.com/'
IMAGE = BASE + 'assets/media/supply-chain-poster.jpg'
START, END = '<!-- seo:start -->', '<!-- seo:end -->'

INDUSTRIES = [
    ('industry-automotive.html', 'Automotive',
     'Automotive supply-chain decision intelligence | Aidecis',
     'Multi-tier, just-in-time automotive supply chains: govern late-part, substitution and EV battery sourcing decisions with clear authority and evidence.'),
    ('industry-pharma-biotech.html', 'Pharma and biotech',
     'Pharma and biotech supply-chain decision intelligence | Aidecis',
     'GMP, cold-chain and serialisation decisions in pharma and biotech: route deviations, batch holds and quality reviews to the right owner, with evidence recorded.'),
    ('industry-food-beverage.html', 'Food and beverage',
     'Food and beverage supply-chain decision intelligence | Aidecis',
     'Food and beverage supply-chain decisions on shelf life, commodity prices and retailer commitments, with the full trade-off and approval on record.'),
    ('industry-contract-logistics.html', 'Contract logistics',
     'Contract logistics and 3PL decision intelligence | Aidecis',
     '3PL and fulfilment decisions across clients and sites: rerouting, returns and customs exceptions with the right client rules, limits and owner.'),
    ('industry-aerospace-defense.html', 'Aerospace and defense',
     'Aerospace and defense supply-chain decision intelligence | Aidecis',
     'Aerospace and defense supply-chain decisions with long lead times, approved sources, certification and export rules kept in the same approval.'),
    ('industry-semiconductors-electronics.html', 'Semiconductors and electronics',
     'Semiconductor and electronics supply-chain decisions | Aidecis',
     'Allocation and alternative-sourcing decisions for semiconductors and electronics, with explicit trade-offs, authority and evidence across the network.'),
    ('industry-medical-devices.html', 'Medical devices',
     'Medical device supply-chain decision intelligence | Aidecis',
     'Medical-device supply-chain decisions on components, traceability and validated processes, with approval kept connected to the evidence.'),
    ('industry-chemicals.html', 'Chemicals and specialty chemicals',
     'Chemical supply-chain decision intelligence | Aidecis',
     'Chemical supply-chain decisions on feedstock, hazardous materials and bulk logistics, with cost, safety evidence and operating authority together.'),
    ('industry-refining-energy.html', 'Refining and energy',
     'Refining and energy supply-chain decision intelligence | Aidecis',
     'Refinery, terminal and energy decisions on unplanned maintenance, rate cuts, cargoes and storage, with authority and safety evidence on record.'),
    ('industry-machinery.html', 'Machinery and industrial equipment',
     'Machinery and industrial equipment supply-chain decisions | Aidecis',
     'Engineer-to-order and spare-parts decisions in machinery and industrial equipment, connected to cost, specification and delivery consequences.'),
    ('industry-fashion-retail.html', 'Fashion, textiles and retail',
     'Fashion and retail supply-chain decision intelligence | Aidecis',
     'Fashion, textile and retail supply-chain decisions on late shipments, air freight and sourcing due diligence, with authority and evidence on record.'),
]

USE_CASES = ['Expedite freight after disruption', 'Inventory reallocation', 'Demand surge allocation',
             'Supplier disruption and alternate source', 'Quality hold, release or substitute', 'Production rescheduling',
             'Logistics reroute or carrier choice', 'Customer promise and backorder priority',
             'Procurement price, quantity or PO exception', 'Invoice variance, claim and close-out',
    'Unplanned failure: run reduced or stop to repair', 'Buy a cargo, and the decisions it sets in motion']

# file: (title, description, breadcrumb name or None for the home page, parent [(name, file)])
PAGES = {
    'index.html': ('Aidecis | Supply-chain decision intelligence and accountability',
                   'Decision intelligence and accountability for supply chains. Govern people, bots and AI agents with clear authority, evidence and outcomes in one decision chain.',
                   None, []),
    'use-cases.html': ('Supply-chain decision intelligence use cases | Aidecis',
                       'Twelve families, 71 consequential supply-chain decisions governed end to end: expedited freight, maintenance, trading, procurement, quality, inventory and more.',
                       'Use cases', []),
    'benefits.html': ('Business case and ROI calculator | Aidecis',
                      'Model a transparent business case for supply-chain decision intelligence with your own assumptions: subscription, onboarding and pilot investment.',
                      'Benefits', []),
    'industries.html': ('Decision intelligence for 10 supply-chain industries | Aidecis',
                        'How Aidecis governs consequential supply-chain decisions in automotive, pharma, food, logistics, aerospace, semiconductors, chemicals and more.',
                        'Industries', []),
    'accountability.html': ('Why Supply-Chain Decisions Lack Accountability | Aidecis',
                            'Ten common supply-chain decision crises, and how Aidecis makes authority, policy, approval, execution and outcome accountable in one chain.',
                            'Decision accountability', []),
    'contact.html': ('Contact Aidecis | Request a demo or pilot',
                     'Contact Aidecis in Andorra to request a product demo, discuss a fixed-scope pilot or ask about decision accountability in your supply chain.',
                     'Contact', []),
    'privacy-policy.html': ('Privacy Policy | Aidecis',
                            'How Aidecis handles personal data, which rights you have and how to contact us about privacy.',
                            'Privacy policy', []),
    'cookie-policy.html': ('Cookie Policy | Aidecis',
                           'Which cookies aidecis.com uses, why, and how to change your cookie preferences at any time.',
                           'Cookie policy', []),
    'terms.html': ('Terms of Service | Aidecis',
                   'The terms of service that apply when you use the Aidecis website and services.',
                   'Terms of service', []),
}
for file, name, title, desc in INDUSTRIES:
    PAGES[file] = (title, desc, name, [('Industries', 'industries.html')])

ORG = {
    '@type': 'Organization', '@id': BASE + '#organization', 'name': 'Aidecis', 'url': BASE,
    'logo': {'@type': 'ImageObject', 'url': BASE + 'assets/aidecis-logo.png', 'width': 1983, 'height': 793},
    'description': 'Decision intelligence and a cross-system decision-accountability layer for consequential supply-chain decisions, taken by people, bots or AI agents.',
    'slogan': 'Intelligence into every decision. Accountability behind every action.',
    'email': 'william.johnson@aidecis.com',
    'address': {'@type': 'PostalAddress', 'streetAddress': 'Fiter i Rossel 46, 5A', 'addressLocality': 'Escaldes-Engordany', 'addressCountry': 'AD'},
    'parentOrganization': {'@type': 'Organization', 'name': 'Angeleus SLU'},
    'knowsAbout': ['Decision intelligence', 'Supply-chain decision making', 'AI agent governance', 'Decision accountability',
                   'Delegation of authority', 'Human-in-the-loop approval', 'Supply-chain risk management'],
}
WEBSITE = {'@type': 'WebSite', '@id': BASE + '#website', 'name': 'Aidecis', 'url': BASE,
           'inLanguage': 'en', 'publisher': {'@id': BASE + '#organization'}}
PRODUCT = {
    '@type': 'SoftwareApplication', '@id': BASE + '#software', 'name': 'Aidecis',
    'applicationCategory': 'BusinessApplication', 'applicationSubCategory': 'Supply-chain decision intelligence',
    'operatingSystem': 'Web', 'url': BASE, 'publisher': {'@id': BASE + '#organization'},
    'description': 'Aidecis governs consequential supply-chain decisions taken by people, existing bots and AI agents: '
                   'who had authority, which policy applied, who approved the exception, what executed and what happened next. '
                   'Policies are managed in a European cloud; a gateway in the customer environment carries out only permitted actions.',
    'featureList': ['Decision registry with evidence and outcome record', 'Policy library for authority, limits and operating rules',
                    'Approval routing and escalation to the accountable owner', 'Gateway for scoped execution in ERP, WMS, TMS and MES',
                    'Registration of bots and AI agents with owner, limits and version', 'Advice when a decision can move between people and bots'],
}


def page_url(file):
    return BASE if file == 'index.html' else BASE + file


def jsonld(file, title, desc, crumb, parents):
    url = page_url(file)
    page = {'@type': 'WebPage', '@id': url + '#webpage', 'url': url, 'name': title, 'description': desc,
            'inLanguage': 'en', 'isPartOf': {'@id': BASE + '#website'}, 'about': {'@id': BASE + '#organization'},
            'primaryImageOfPage': {'@type': 'ImageObject', 'url': IMAGE}}
    if file == 'contact.html':
        page['@type'] = 'ContactPage'
    graph = [ORG, WEBSITE, page]
    if file == 'index.html':
        graph.append(PRODUCT)
    if crumb:
        items = [('Home', 'index.html')] + parents + [(crumb, file)]
        page['breadcrumb'] = {'@id': url + '#breadcrumb'}
        graph.append({'@type': 'BreadcrumbList', '@id': url + '#breadcrumb', 'itemListElement': [
            {'@type': 'ListItem', 'position': i + 1, 'name': n, 'item': page_url(f)} for i, (n, f) in enumerate(items)]})
    if file == 'use-cases.html':
        graph.append({'@type': 'ItemList', 'name': 'Consequential supply-chain decisions', 'itemListElement': [
            {'@type': 'ListItem', 'position': i + 1, 'name': n, 'url': f'{url}#decision-{i + 1}'} for i, n in enumerate(USE_CASES)]})
    if file == 'industries.html':
        graph.append({'@type': 'ItemList', 'name': 'Industries', 'itemListElement': [
            {'@type': 'ListItem', 'position': i + 1, 'name': n, 'url': page_url(f)} for i, (f, n, _, _) in enumerate(INDUSTRIES)]})
    data = json.dumps({'@context': 'https://schema.org', '@graph': graph}, ensure_ascii=False, separators=(",", ":"))
    return data.replace('</', '<\\/')


def attr(value):
    return value.replace('&', '&amp;').replace('"', '&quot;').replace('<', '&lt;')


for file, (title, desc, crumb, parents) in PAGES.items():
    path = ROOT / file
    html = path.read_text()
    url = page_url(file)
    html = re.sub(r'<title>.*?</title>', f'<title>{attr(title)}</title>', html, count=1, flags=re.S)
    if re.search(r'<meta name="description"[^>]*>', html):
        html = re.sub(r'<meta name="description"[^>]*>', f'<meta name="description" content="{attr(desc)}">', html, count=1)
    else:
        html = re.sub(r'(\s*)<title>', rf'\1<meta name="description" content="{attr(desc)}">\1<title>', html, count=1)
    block = '\n'.join([
        START,
        f'<link rel="canonical" href="{url}">',
        '<meta property="og:type" content="website">',
        '<meta property="og:site_name" content="Aidecis">',
        f'<meta property="og:title" content="{attr(title)}">',
        f'<meta property="og:description" content="{attr(desc)}">',
        f'<meta property="og:url" content="{url}">',
        f'<meta property="og:image" content="{IMAGE}">',
        '<meta property="og:image:width" content="1280">',
        '<meta property="og:image:height" content="720">',
        '<meta property="og:image:alt" content="Supply chain in motion: fields, production, transport and ports.">',
        '<meta property="og:locale" content="en_GB">',
        '<meta name="twitter:card" content="summary_large_image">',
        f'<meta name="twitter:title" content="{attr(title)}">',
        f'<meta name="twitter:description" content="{attr(desc)}">',
        f'<meta name="twitter:image" content="{IMAGE}">',
        f'<script type="application/ld+json">\n{jsonld(file, title, desc, crumb, parents)}\n</script>',
        END,
    ])
    if START in html:
        html = re.sub(re.escape(START) + '.*?' + re.escape(END), lambda _: block, html, count=1, flags=re.S)
    else:
        html = html.replace('</head>', block + '\n</head>', 1)
    # The new titles and descriptions get their Spanish and Dutch versions from seo-translations.js, loaded just before site.js.
    if 'assets/seo-translations.js' not in html:
        html, n = re.subn(r'(<script src="assets/site\.js)', r'<script src="assets/seo-translations.js?v=20261026-seo1"></script>\1', html, count=1)
        assert n == 1, file
    path.write_text(html)

# Sitemap: every page with the date of its last commit.
def lastmod(file):
    out = subprocess.run(['git', 'log', '-1', '--format=%cs', '--', file], cwd=ROOT, capture_output=True, text=True).stdout.strip()
    return out or '2026-10-26'

order = ['index.html', 'use-cases.html', 'benefits.html', 'industries.html', 'accountability.html', 'contact.html'] + \
        [f for f, *_ in INDUSTRIES] + ['privacy-policy.html', 'cookie-policy.html', 'terms.html']
lines = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
for f in order:
    lines.append(f'  <url><loc>{page_url(f)}</loc><lastmod>{lastmod(f)}</lastmod></url>')
lines.append('</urlset>')
(ROOT / 'sitemap.xml').write_text('\n'.join(lines) + '\n')
print('updated', len(PAGES), 'pages and the sitemap')
