# antislop audit 001: follow-up

Approved: 2–17. Owner decisions: remove the dash from words of command; stay desktop-focused (R-03 override).
Not approved: 1 (design direction), 18 (README inline-header lists).

| # | Fix | Evidence |
|---|---|---|
| 2 | Words of command use commas and periods ("To the Right, Wheel. Halt, Dress"); Makefile help reads "LOBSTER make targets:" | `grep` finds no `—` in src, README, Makefile, terraform, .github, docs |
| 3 | Terraform OAC comment and 11 doc occurrences rewritten | same grep |
| 4 | `draftNote` on the drill module, shown in the Orders panel; setup reads "1764 Manual (draft values)" | headless check: note visible in both themes |
| 5 | Platoon fills come from `platoonColour()`, which pushes the company colour toward ink until it clears 3:1 on the field, then steps per platoon | `tests/ui/colour.test.ts`: 6 colours × 6 platoons ≥ 3:1, neighbours differ |
| 6 | Same function runs against the dark field and ink; guide, officers, arrow and order marks use it too | colour test covers the dark palette; dark screenshot shows every man |
| 7 | Field is focusable: arrows move, `[` `]` rotate 5° (Shift 45°), `+` `-` change depth holding the dressing point, Escape clears selection; visible focus ring | `keyEdit` tests; headless: ghost moved +1/+10, front 1.484 rad, 2 deep, Escape cleared selection |
| 8 | Order words are real buttons (Enter/Space); ↑ ↓ move buttons per row | headless: Enter seeked to 0:10, "Move order 2 up" swapped rows |
| 9 | "Suggest orders (coming soon)" with a `// TODO` | headless: label visible, disabled |
| 10 | Empty field draws "The field is empty" with the next step | headless screenshot, light and dark |
| 11 | Desktop-only recorded as an owner override in README | README "How to use it" |
| 12 | Side-panel subheadings are sentence case in the heading face, no tracking | screenshot |
| 13 | `--control-border` #8a8374 light (3.33–3.60:1), #85806f dark (3.93–4.31:1) on buttons, inputs, selects, segmented controls | contrast-check.py |
| 14 | Banner separators removed from terraform | `grep ──` empty |
| 15 | Label and restating comments removed from render.ts and camera.ts | diff |
| 16 | Header and workflow comments cut to one line each | diff |
| 17 | Drill shown as text instead of a one-option select | screenshot |

Verification: typecheck clean, 77/77 tests, production build, headless click-through in light and dark with no console errors.
