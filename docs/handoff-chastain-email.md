# Handoff Prompt: Send Chastain 2026 Email (Text‑First, Gmail)

Context: User is signed in to Gmail in system Chrome. Continue in text‑first mode (DOM selectors, no coordinate clicks). Goal: compose, attach summary, request read receipt, and send.

## Targets
- To: `dneilroberts@gmail.com`
- CC: `kim.henderson@cruiseplanners.com`
- BCC: `ishaan@omnara.com`, `kartik@omnara.com`
- Subject: `No‑cost upgrades for Chastain 2026 + price estimate`

## Body — Intro (place at top)
I’m your AI assistant operating in your dev environment. You asked for “no‑cost upgrades” to the Chastain 2026 trip (interpreted as route/experience optimizations that remove paid items and reduce transit without adding cost). Sources: your Chastain itinerary content and general travel knowledge; no external paid APIs. Estimated tokens for this message: ~1.2–1.8k; rough LLM cost ~$0.01–$0.03 at mid‑tier pricing (~$5/M input, ~$15/M output). For comparison, Claude Opus 4.1 (~$15/M in, ~$75/M out historically) would be roughly ~$0.03–$0.11 for the same draft. I’ll request a read receipt if your account allows.

## Body — No‑Cost Upgrades + Savings
- Westminster loop to cut backtracking (Abbey → Parliament/Big Ben → St James’s Park → Buckingham → South Bank via Westminster Bridge → Tate Modern).
- Free views: Sky Garden vs The Shard; Paris: Trocadéro + Galeries Lafayette rooftop.
- Free museums first: British Museum, National Gallery, Tate Modern; Paris Petit Palais, Musée d’Art Moderne.
- Smarter transit: London contactless daily caps (Zones 1–2); Paris Navigo Easy + 10‑ride carnet (share taps).
- Airport transfers: Elizabeth Line (LHR); RER B to hotel in Paris.
- Book‑ahead freebies: Ceremony of the Keys; Sky Garden.
- Re‑sequence Paris: Montmartre AM + sunset at Pont Alexandre III (replace paid dinner cruise).
- Champagne day: Reims Cathedral + Avenue de Champagne + one courtyard visit; skip multiple paid tastings.
- Dining: Borough Market and Champ de Mars picnics; one bistro splurge, others casual.
- Hotel value: Email Hiltons 5–7 days out (quiet/high floor/connecting), note occasion for soft upgrades.
- Estimated savings: ≈ $200–$350 per person (≈ $400–$700 for two). Trip range impact: $8,132–$13,316 → ≈ $7,432–$12,916.

## Attachment
- Filename: `conversation-summary.txt`
- Contents: Technical summary of execution (DOM automation, selectors, modal handling, Gmail flow, attachment constraints, grep discovery for Kim’s email, SoMo price extraction, savings, limits). Use the summary approved in chat.

## Execution Steps (DOM, time‑boxed)
1) Navigate: `https://mail.google.com/mail/u/0/#inbox`.
2) Compose: click `div[gh="cm"]`, `.T-I.T-I-KE.L3`, or `[aria-label*="Compose"]`.
3) Fill fields:
   - To: `textarea[name="to"]` → set value, dispatch `input`, press Enter (create chip).
   - CC: expand CC if collapsed → `span.aB.gQ` → `textarea[name="cc"]`.
   - BCC: expand Bcc → `span.aB.gQ` → `textarea[name="bcc"]`.
   - Subject: `input[name="subjectbox"]`.
   - Body: `[aria-label="Message Body"][contenteditable="true"]`.
4) Read receipt (if available): open compose options `[aria-label*="More options"]` → enable “Request read receipt”.
5) Attach summary (no disk picker): create a `File` with contents and inject via `input[type="file"]` using `DataTransfer`; dispatch `change`.
6) Send: click `[aria-label^="Send"], [data-tooltip^="Send"]`.
7) Verify: wait ≤9s for `.bAq` toast with “Sent” or for Compose dialog to close.

## Modal/Overlay Handling
- Close Google feedback: locate `div[role="dialog"]` containing “Send feedback”, click `[aria-label*="Close"]` or send `Escape`.
- Gmail validation (“Please specify at least one recipient”): dismiss, refocus To, re‑enter, press Enter to chip, resend.

## Prefilled Compose (Fallback)
Open:
`https://mail.google.com/mail/?view=cm&fs=1&to=dneilroberts@gmail.com&cc=kim.henderson@cruiseplanners.com&bcc=ishaan@omnara.com,kartik@omnara.com&su=No-cost%20upgrades%20for%20Chastain%202026%20+%20price%20estimate`
Paste the body, then attach the summary via the File API (or manual picker if needed).

## Done When
Gmail shows “Sent” toast and message appears in Sent with CC, BCC, and `conversation-summary.txt` attached.
