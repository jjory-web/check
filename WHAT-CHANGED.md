# v0.8 beta: dictionary-backed candidate engine (NOT production-ready)

- Entire standard dictionary retained. No hand-coded misspelling pair table.
- Searches spellings with attached particles; counters from POS.
- A dictionary suggestion is a REVIEW, not a certain correction.
- `오랫만` and `오랜만` both appear in the supplied data; without definition/normative metadata this dataset alone cannot make the determination.
- Complete Garu integration and browser regressions MUST pass in GitHub Actions before deploy.
- Existing UI unchanged. Do not replace working main without checking Actions.
