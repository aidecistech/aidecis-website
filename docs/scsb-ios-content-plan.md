# Website plan: Supply Chain Second Brain, governed knowledge, iOS app, new decision routes

Branch: `feat/scsb-and-ios-content`. Approved for publication by Neil on 26 Nov 2026; awaiting pull-request checks and merge. The merge publishes the site through the configured TransIP workflow.

## Decisions recorded

- Keep Supply Chain Second Brain product-internal for now; do not name it on the public site.
- Give the executive app its own page. Use an illustrative screen mockup in the Aidecis website style.
- Define any learning signal as an aggregate pattern across decisions, not a score or inference about an individual. Keep tenant-level control and privacy safeguards explicit.
- Internal product status: the app is ready and working; App Store publication is pending. Keep this operational status off the public page.
- Delegation carries the decision authority by default, subject to the organisation’s setting. If overdue, the decision returns to its accountable owner. A recommendation-only route can remain a configurable option.
- Add the ten guided decision slices from the supplied screenshot and expand Governed Knowledge as a distinct buyer-facing explanation.

## Baseline before this website draft

- The site is static HTML, one file per page, published to TransIP on merge to main. Nav: Use cases, Benefits, Industries, Compare, S-CLAIM model, Security and data, Decision intelligence layer.
- The seven-step core is on the homepage ("Seven steps, from the signal to the outcome": Detect, Context, Consequences and authority, Weigh and explain, Act or route, Observe, Record and learn). Step 05 "Act or route" is where delegation belongs; it is not yet explained.
- `use-cases.html` is the decision library: twelve families, 72 decisions, governed end to end.
- `decision-intelligence-layer.html` holds the only "governed knowledge" idea today: S-CLAIM "learns from a body of supply-chain decision knowledge that Aidecis built and owns", framed as how the model is trained, with "your data only if you opt in."
- Not in the baseline site: Supply Chain Second Brain, Academy, the executive iOS app and the default delegation/overdue-return behavior. Second Brain remains product-internal in this draft.

## Current branch draft

- `index.html` explains authority-carrying delegation and links to the app page.
- `decision-intelligence-layer.html` adds a Governed Knowledge explanation with scoped public-material wording, privacy boundaries and a delegation section.
- `use-cases.html` adds the ten guided decision slices without the setup-progress fractions shown in the supplied screenshot.
- `executive-app.html` introduces the executive app with three native iPhone screen images matching the supplied iOS references. The screenshot UI remains in English; the captions have Spanish and Dutch translations. The second caption says the CSCO only receives requests above the mandates they set for their teams, and that Aidecis follows each organisation’s own policies. The page uses the site’s Georgia display headings and system sans-serif body copy; public copy omits publication status.
- `decision-costs.html` adds an evidence-led market-intelligence page with the ten decision slices, source-linked cost benchmarks and scope notes. It makes clear that the figures measure different exposures and are not Aidecis savings or one summed global total. The hero reuses the existing real port photograph; it does not use generated artwork. The page is linked from the homepage, use-cases page and executive-app page and is listed in the sitemap.
- The unused, obviously generated `assets/media/aidecis-shipment-decision-flow.gif` illustration and its preload reference were removed. The individual iPhone screen previews are saved in `outputs/executive-app-screen-01.png`, `outputs/executive-app-screen-02.png` and `outputs/executive-app-screen-03.png` for review.
- These are local review changes on this feature branch. The live site and App Store listing have not been changed.

## 1. Naming: Second Brain vs Academy

Your rule: inside Aidecis the contextual learning is the Supply Chain Second Brain; the Academy is the standalone use of the same curriculum. The public site mentions neither, so there is no wrong link to fix yet, but we set the rule now so every new page and every in-product string is consistent:

- In-product "learn more" link, triggered by an operating pattern → labelled and described as Supply Chain Second Brain.
- The curriculum used on its own (decision engineers, client training, certification) → Academy.
- One short naming note in the repo so app, csm and academy copy follow the same split.

Public-site treatment: do not name the Second Brain or describe its learning trigger as a released marketing feature. Keep the five-step product behavior in the internal product and design documentation until its privacy, consent, governance and release gates are complete.

## 2. Supply Chain Second Brain: the trigger design

Your five steps, written for the site and for the product, with the privacy framing kept explicit:

1. Aidecis detects an aggregate operating pattern (across the client's own decisions, never one person's single action).
2. The pattern is mapped to a relevant subject in the curriculum.
3. The decision owner sees a contextual "learn more" link, in context, never forced.
4. The Second Brain opens the relevant lesson. No client data leaves the tenant; the lesson is general curriculum, the pattern that triggered it stays inside.
5. Any future activation beyond showing a lesson passes privacy, consent, governance and release gates first.

Design points for internal product work:
- The link may appear on the decision and overview only where the relevant aggregate pattern is present; it is contextual and never forced.
- Make it role-relevant and tenant-configurable, with an off switch.
- Define an aggregate pattern across multiple decisions, suppress low-count slices that could expose an individual, and prohibit individual scoring or ranking.

On the site this becomes a new section, cleanest as an extension of the existing S-CLAIM / governed-knowledge block on `decision-intelligence-layer.html`, plus a short standalone explainer if we decide to name it publicly.

## 3. Governed knowledge: what it is and what it does

Replace the existing section's unscoped "built and owns" and "your data only if you opt in" claims with a clear account of the reusable framework, the client-specific policy boundary and the material used in public examples. Candidate public copy:

> Aidecis structures reusable decision knowledge into decision types, signals, evidence, authority paths, policies and outcome measures. This framework helps prepare explainable decision briefs. Each client’s policies determine who may decide and which actions are allowed. Client information remains tenant-separated and is not used to train shared models. Public examples use material Aidecis authored or is cleared to share.

This is proposed copy for review. It does not claim ownership of client data, third-party source material or every item in the underlying library. Any stronger provenance, privacy or release claim must match the specific material and controls it describes.

The section should answer three buyer questions:

- What the knowledge is: a reusable structure for decision types, evidence, authority paths, rules and outcomes, backed only by material Aidecis authored or is cleared to share.
- What it does in the product: helps identify the decision and prepare an explainable brief; deterministic policy code applies the client’s configured authority and rules.
- What it does with client data: distinguish tenant-separated client content from shared-model training and any optional, separately consented learning.

## 4. Executive iOS app page

Create `executive-app.html`. Purpose: Decision Intelligence access from the phone, for the executive who decides between meetings.

Content:
- What it is: see the decisions that need your authority, and approve, decline or delegate, each confirmed with Face ID and signed on the device.
- The governed decision routes it exposes (section 5).
- Do not include Second Brain or learning-trigger UI in the public app mockup while the feature remains product-internal.
- Security line: the phone registers its own key, nothing is executed from the phone beyond the signed decision, every action is on the record. This matches what we built in aidecis-ios.
- Public copy focuses on the executive workflow; omit app-store publication status.

## 5. The new governed decision routes

Delegation extends step 05 "Act or route". Write it on the homepage seven-step section, the app page and the decision-intelligence-layer page:

- A decision owner can delegate a decision to someone in the team.
- By default the owner's authority moves with the decision to the person who then decides; a company setting controls this ("does the mandate move with a delegated decision?").
- The delegation is itself a decision: who, to whom, when, the instruction, and how it ended, all on the record.
- If the delegate does not decide in time, it returns to the owner by itself.

Proposed public copy:

> Delegation follows the organisation’s configured authority policy. By default, the delegated decision carries authority to act within its approved limits. If it is not resolved by the due time, it returns to the accountable owner. Organisations can configure a recommendation-only route where the owner retains final approval.

Keep the user, recipient, due time, instruction and outcome on the decision record. Avoid presenting this behavior as a universal default where a client setting changes the route.

## Ten guided decision slices

Add the ten names supplied by the user as a visible guided path on `use-cases.html`. Show the decision structure rather than setup-progress fractions. Each example should be labelled illustrative and may link into the existing family-level library:

1. 10.1 Expedite freight
2. 4.1 Inventory reallocation
3. 2.2 Alternate supplier
4. 2.4 PO exception
5. 2.1 Price beyond envelope
6. 2.3 Spot buy outside contract
7. 3.3 Order outside policy
8. 3.1 Demand surge allocation
9. 6.4 Express spare part
10. 6.2 Machine breakdown response

## Implementation status and release sequence

- Link to the executive app from the home and decision-layer pages and add it to the main site navigation and footer where the shared navigation allows.
- [x] Governed Knowledge rewrite on the layer page.
- [x] Ten guided decision slices on the use-cases page.
- [x] Delegation copy on the home, layer and app pages.
- [x] Executive-app page and three iPhone screen images based on the supplied native iOS references.
- [x] Review the site, app screens and translated copy with Neil; the screenshot UI remains English.
- [x] Approve the public Governed Knowledge wording and source-linked cost evidence for the named material.
- [x] Prepare this pull request for publication after approval.
- Match existing Aidecis typography (Georgia display headings and system sans-serif body), blue-green palette, amber accents and documentary supply-chain photography. Keep the supplied app screens in their native iOS typography. Do not introduce generic AI art or product-progress fractions.
- Merge to `main` only after pull-request checks and review are clear; the configured workflow then publishes to TransIP and compares the live site with the published files.

## Release record

- Neil approved the website mockups and asked to proceed with publication on 26 November 2026.
- iPhone screenshot UI stays in English; page captions and the cost page support Spanish and Dutch.
- Pull-request checks and the live TransIP content comparison remain the release gates.
