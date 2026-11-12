# Experiment log

Issues found while building the site, and how they were corrected. Newest at the bottom.

## 2026-11-12: Part 2 dashboard

### Issues and corrections

| # | Issue | How it was found | Correction |
|---|---|---|---|
| 1 | Zooming the map to one town (scale ~260–600×) showed a blank or half-drawn map: markers and sale dots were missing. | Screenshot of the map after choosing Champaign, IL in the one Playwright check. | Chromium does not reliably draw an SVG group with such a large `transform`. The map now re-projects every coordinate on each zoom step and clips state outlines to the view (`d3.geoClipRectangle`), so no huge transform is used. |
| 2 | Sale dots for a selection included the implausible prices, so the map legend started at $7.5K, below the site's price rule. | Map legend in the same screenshot. | Dots now use only sales that pass the price rule, like every other figure. |
| 3 | The theme button's "◐" character rendered as a different glyph in the test browser's font. | Screenshot. | Replaced with a small inline SVG icon. |
| 4 | Part 1's $1,000 floor kept 36 sales priced $1,000–$9,999 and 31 over $5,000,000 (up to $81.5M), which would distort Q6's mean. | Data description sheet, problem 3. | Site-wide rule: $10,000 ≤ price ≤ $5,000,000. 71 sales are excluded (40 low, 31 high); the counts are computed and shown on the page. |
| 5 | The CDN (cdn.jsdelivr.net) was not reachable from the build environment, and a CDN outage would also break the live site. | `curl` returned 403. | D3, topojson-client and the state outlines are committed in `vendor/` with their licenses. |

### Numbers cross-checked against pandas (CSV, same rule)

| On the page | pandas |
|---|---|
| 35,371 sales used; median $410,000; mean $500,972 | 35,371; 410,000; 500,972 |
| Q1 ($0–$400,000): Gainesville 3,491 of 5,467 | 3,491 of 5,467 |
| Q3 (3 beds, ≥10 sales): Champaign $215,000, next Urbana $225,000 | 215,000; 225,000 |
| Q4 (≥1,500 sq ft): Davis $477/sq ft | 476.58 |
| Q7 (garage, all cities): +$75,500 | 75,500 |
| Q9 (Gainesville, 2025): June, 222 sales | June 222, May 211 |

### Tested

- One Playwright run (Chromium) at 1360×900 and 390×844: the page loads with no console errors; all ten answer lines render; choosing a city in the menu sets the university menu, highlights the state, zooms and draws 2,285 sale dots; the theme toggle switches to dark; no horizontal page scroll at phone width.
- The numbers in the table above.

### Not tested

- Safari, Firefox and real touch devices (pinch and drag on the map).
- Screen-reader output, and keyboard use of the map markers (they are focusable buttons but were not tried with a keyboard).
- Filter combinations other than the defaults, and tablet widths between 600 and 1,024 px.
- The live GitHub Pages deployment (not merged yet).
