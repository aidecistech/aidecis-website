# Website plan: Supply Chain Second Brain, governed knowledge, iOS app, new decision routes

Branch: `feat/scsb-and-ios-content`. Draft for discussion, 26 Nov 2026. Nothing here is built yet.

## What the site says today

- The site is static HTML, one file per page, published to TransIP on merge to main. Nav: Use cases, Benefits, Industries, Compare, S-CLAIM model, Security and data, Decision intelligence layer.
- The seven-step core is on the homepage ("Seven steps, from the signal to the outcome": Detect, Context, Consequences and authority, Weigh and explain, Act or route, Observe, Record and learn). Step 05 "Act or route" is where delegation belongs; it is not yet explained.
- `use-cases.html` is the decision library: twelve families, 72 decisions, governed end to end.
- `decision-intelligence-layer.html` holds the only "governed knowledge" idea today: S-CLAIM "learns from a body of supply-chain decision knowledge that Aidecis built and owns", framed as how the model is trained, with "your data only if you opt in."
- Not on the site at all: Supply Chain Second Brain, Academy, the executive iOS app, delegation, the word mobile except "works on your phone" for the demo.

## 1. Naming: Second Brain vs Academy

Your rule: inside Aidecis the contextual learning is the Supply Chain Second Brain; the Academy is the standalone use of the same curriculum. The public site mentions neither, so there is no wrong link to fix yet, but we set the rule now so every new page and every in-product string is consistent:

- In-product "learn more" link, triggered by an operating pattern → labelled and described as Supply Chain Second Brain.
- The curriculum used on its own (decision engineers, client training, certification) → Academy.
- One short naming note in the repo so app, csm and academy copy follow the same split.

Open question for you: do we name the Second Brain publicly on the marketing site now, or keep it as a capability inside the product pages until it is live?

## 2. Supply Chain Second Brain: the trigger design

Your five steps, written for the site and for the product, with the privacy framing kept explicit:

1. Aidecis detects an aggregate operating pattern (across the client's own decisions, never one person's single action).
2. The pattern is mapped to a relevant subject in the curriculum.
3. The decision owner sees a contextual "learn more" link, in context, never forced.
4. The Second Brain opens the relevant lesson. No client data leaves the tenant; the lesson is general curriculum, the pattern that triggered it stays inside.
5. Any future activation beyond showing a lesson passes privacy, consent, governance and release gates first.

Design points to decide with you:
- Where the link appears: on the decision, on the overview, or both.
- Whether it is per-person or per-role, and whether a client can switch it off per tenant.
- How "aggregate pattern" is defined so it never reads as surveillance of one employee. This is the line that makes or breaks trust, and it is the same privacy spine as the rest of the platform.

On the site this becomes a new section, cleanest as an extension of the existing S-CLAIM / governed-knowledge block on `decision-intelligence-layer.html`, plus a short standalone explainer if we decide to name it publicly.

## 3. Governed knowledge: what it is and what it does

Extend the existing "Trained on how supply-chain decisions work. Your data only if you opt in." section so it answers three questions a buyer asks:

- What the knowledge is: a body of supply-chain decision knowledge Aidecis built and owns, not scraped general text.
- What it does in the product: grounds the recommendation, the authority routing and the Second Brain link.
- What it does with client data: nothing leaves the tenant; a client's own decision register and history stay tenant-separated. This ties to your open-weights idea (a model fine-tuned on generic supply-chain knowledge, each client's register in a separate knowledge base).

## 4. Executive iOS app page

New page, `executive-app.html` (or a section on the decision-intelligence-layer page; I recommend its own page). Purpose: Decision Intelligence access from the phone, for the CSCO who decides between meetings.

Content:
- What it is: see the decisions that need your authority, and approve, decline or delegate, each confirmed with Face ID and signed on the device.
- The governed decision routes it exposes (section 5).
- The Second Brain on the phone: a contextual link where a pattern is relevant.
- Security line: the phone registers its own key, nothing is executed from the phone beyond the signed decision, every action is on the record. This matches what we built in aidecis-ios.
- Status: working, not yet released; honest "in development" line, no app-store promise.

## 5. The new governed decision routes

Delegation extends step 05 "Act or route". Write it on the homepage seven-step section and, in full, on the app page and the decision-intelligence-layer page:

- A decision owner can delegate a decision to someone in the team.
- By default the owner's authority moves with the decision to the person who then decides; a company setting controls this ("does the mandate move with a delegated decision?").
- The delegation is itself a decision: who, to whom, when, the instruction, and how it ended, all on the record.
- If the delegate does not decide in time, it returns to the owner by itself.

This is a genuine differentiator to state plainly: delegation that carries the authority and stays accountable, not a forwarded email.

## Information architecture and build sequence

- Add one nav/footer entry for the executive app. Keep the Second Brain inside the decision-intelligence-layer page unless we decide to name it publicly, then it earns its own page.
- Build order once you approve: (1) decision-intelligence-layer governed-knowledge + Second Brain section; (2) executive app page; (3) delegation into the seven-step and use-case narrative; (4) naming note in the repo.
- Every page follows the existing site style and passes the Semgrep PR scan; one PR per area so you can review each.

## What I need from you

- Name the Second Brain publicly now, or keep it product-internal for launch.
- Executive app: its own page, or a section on the layer page.
- The "aggregate pattern" definition and the per-tenant off switch for the Second Brain.
- Whether the app page may say "in development" publicly before release.
