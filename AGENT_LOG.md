# Agent log

## 2026-11-10: Median sale price chart and table

- **Asked:** "Read AGENTS.md and docs/data_description_sheet.md first. Then show every median sale price on index.html rounded to whole dollars, in both the chart and the table."
- **Agent produced:** Replaced the construction placeholder with a page that computes median sale prices for every town from the CSV and shows whole-dollar values in a bar chart and table.
- **Checked or changed:** Read the data description first and used its $1,000 low-price exclusion consistently; the page also reports how many sales contribute to each town median.

## 2026-11-12: Part 2 — interactive dashboard redesign

- **Asked:**

  ```text
  Build Part 2 of the College-Town Home Sales website.

  Repository: jiisuuann/campustown-home-sales-claude

  Read AGENTS.md and docs/data_description_sheet.md first.

  Redesign the current Part 1 website from scratch as a professional, presentation-style interactive data visualization dashboard. Use the official dataset and preserve GitHub Pages compatibility, original dataset files, and existing logs.

  Implement the following:

  1. Geographic dashboard:
  - Recognizable U.S. map with all 18 college towns.
  - Interactive city and university selection.
  - Bidirectional synchronization between map markers and dropdowns.
  - Highlight selected states and automatically zoom to selected towns or campus areas.
  - Reset to national view.

  2. Basic dashboard:
  - Dynamic sales counts, median prices, and a meaningful price-distribution chart.
  - Clear presentation-style analytical sections.
  - Separate question-specific filters.

  3. Analysis questions Q1–Q9:
  Q1: Rank cities by sales within a selected budget, including counts and qualifying shares.
  Q2: Show median sale price by campus-distance band for a selected university.
  Q3: Find the lowest-median-price city for a selected bedroom count.
  Q4: Rank cities by median transaction-level price per square foot above a selected minimum living area.
  Q5: Show median price trends by year or quarter for a selected city.
  Q6: Compare mean and median sale prices for a selected city or price range.
  Q7: Compare median prices with and without garages, basements, or fireplaces.
  Q8: Compare median prices across construction-year groups within a selected living-area range.
  Q9: Find the busiest sales month for a selected city and year.

  4. UI requirements:
  - Responsive desktop, tablet, and mobile layout.
  - Light/dark theme toggle.
  - Clear numerical answers, charts, and tables.
  - Independent filters and resets for each question.
  - Maintain consistent styling and accessible labels.

  5. Documentation:
  - Preserve AGENT_LOG.md history.
  - Append this exact prompt and an implementation summary.
  - Record issues and corrections in docs/EXPERIMENT_LOG.md.
  - Briefly document tested and untested functionality.

  Workflow:
  - Work on a new feature branch.
  - Do not modify the source datasets.
  - Keep the implementation compatible with static GitHub Pages.
  - Minimize unnecessary dependencies and avoid extensive test suites or repeated browser checks.
  - Perform only lightweight checks where practical.
  - Commit and push the implementation and open a pull request into main.
  - Do not merge or deploy without my approval.
  - Summarize the results and remaining work concisely.
  ```

- **Agent produced:**
  - A new single-page dashboard: `index.html`, `css/styles.css`, `js/app.js`. Still plain HTML/CSS/JS, no build step.
  - `scripts/build_dashboard_data.py` (Python standard library only) writes `data/dashboard_sales.json`, a column subset of the CSV (2.3 MB instead of 9 MB). All rows are kept; every rule and statistic is computed in the browser.
  - D3 7.9.0, topojson-client 3.1.0 and the us-atlas state outlines are committed in `vendor/` (licenses in `vendor/LICENSES.txt`), so the site does not depend on a CDN.
  - Geographic dashboard: U.S. map with 18 town markers sized by sales; university and city menus kept in sync with marker clicks and with the city bar chart; selected states highlighted; automatic zoom to the town or campus area with each sale drawn as a price-shaded dot; "National view" reset and +/− zoom buttons.
  - Basic dashboard: KPI tiles (sales, median price, median $/sq ft, median miles to campus) and a price histogram with a median line and a price-band table, all following the map selection.
  - Q1–Q9, each with its own filters, reset button, one-line numerical answer, chart and table.
  - Light/dark theme toggle (remembered in the browser), responsive layout for desktop, tablet and phone, and a data-notes section stating every rule.
- **Checked or changed:**
  - Price rule changed from Part 1: sales from $10,000 to $5,000,000 are used (35,371 of 35,442). Part 1's $1,000 floor was raised because Q6 compares means, and the data sheet warns that averages are meaningless without a rule for the implausible low and high prices. Groups with fewer than 10 sales are faded and never picked as an answer.
  - Cross-checked six on-page answers against pandas on the CSV; all matched (see `docs/EXPERIMENT_LOG.md`).
  - The agent got the map wrong at first: zooming to a single town drew nothing, because browsers stop drawing an SVG group scaled ~300×. Caught in a screenshot; fixed by re-projecting coordinates on each zoom step.

Add a dated entry each time you work with your AI coding agent, with the newest entry at the bottom. Each entry records what you asked the agent, what it produced, and what you checked or changed. Paste your key prompts in exactly as you typed them. Include at least one time the agent got something wrong, and how you caught it.

Copy this outline for each entry:

```markdown
## YYYY-MM-DD: What you worked on

- **Asked:** "Paste your prompt here."
- **Agent produced:** What it made or changed.
- **Checked or changed:** How you checked it, and what you fixed.
```
