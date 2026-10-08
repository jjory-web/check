# v0.8 experimental correction engine — validation status

This is an experimental source bundle, **not a verified production release**.

Changes from v0.7:
- Whole-lexicon spelling candidate search for unattested surfaces, including several attached particles. Corrections are marked review-only.
- Dictionary-POS-based counter splitting for limited quantity modifiers.
- Additional guard against combining standalone verbal / auxiliary expressions.
- Added lexical unit regression tests.

Validated locally on 2026-10-08:
- `node --test tests/lexical-review.test.mjs`: 4 passed.
- `node --check src/proofreader.mjs` and `src/lexicon.mjs`: parsed.

Not validated:
- Full `npm test`, browser tests, and Vite build. `garu-ko` package contents were unavailable in this execution environment, and `npm ci --offline` failed due to missing cached packages. This does NOT establish a defect in the repository package itself.
- Full source spell-check precision, recall, and long-paragraph accuracy.

Known unsolved problems:
- Source lexicon has both `오랫만` and `오랜만` as headwords; without normative metadata, headword membership cannot adjudicate these.
- Morphological candidate rejection may still miss errors and produce false suggestions.
- Dictionary data does not have semantic definitions or contextual usage labels in this bundle.
- Quantity-modifier inventory is still limited; do not infer general grammar coverage.

Before releasing: run `npm ci && npm run test:all` in a network-enabled environment, then check the 225-character paragraph and new unseen texts manually. Do not replace your live website without reviewing the results.
