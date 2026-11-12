# [Your site's title]

## Start here (delete this section before you submit)

This repository is your starting point for the Home Sales case. It already holds the dataset, its description sheet, project instructions for your AI coding agent, and outlines of the README and agent log that the case asks for.

1. **Turn on GitHub Pages.** In this repository, open **Settings**, then **Pages**. Under "Build and deployment," set **Source** to **GitHub Actions**. GitHub may suggest workflows to add. Skip them: this repository already has one, `.github/workflows/pages.yml`.
2. **Publish for the first time.** Open the **Actions** tab, choose **Publish site to GitHub Pages** in the sidebar, click **Run workflow**, then click **Run workflow** again to confirm. If the tab already shows a failed run from when you created the repository, that's expected: Pages wasn't turned on yet. When the new run shows a green check, your site is at `https://jiisuuann.github.io/campustown-home-sales-claude/ (after the Part 2 pull request is merged)`. It shows a placeholder page until you replace `index.html`.

    From then on, every push to the main branch publishes the site within a few minutes. If the live site doesn't show a change, open the **Actions** tab. A red X means the publish failed, and the run's log says why.
3. **Open the repository in your AI coding agent.** Its project instructions are in `AGENTS.md`. If your agent reads its instructions from a file with a different name, check its documentation and copy `AGENTS.md` to that name. Add to the instructions as you learn what your agent needs.
4. **Read `docs/data_description_sheet.md`** before you ask the agent for any analysis.
5. **Build in small steps,** as the setup guide describes. Add an entry to `AGENT_LOG.md` each time you work with the agent.
6. **Fill in every section below** before you submit.

| Path | What it is |
|---|---|
| `index.html`, `css/styles.css`, `js/app.js` | The dashboard (Part 2): map, price distribution and questions Q1–Q9 |
| `data/dashboard_sales.json` | Column subset of the CSV that the site reads, made by `scripts/build_dashboard_data.py` |
| `vendor/` | D3 7.9.0, topojson-client 3.1.0 and us-atlas state outlines, with licenses |
| `docs/EXPERIMENT_LOG.md` | Issues found while building, their fixes, and what was and wasn't tested |
| `data/college_town_home_sales.csv` | The dataset, version 1.0: 35,442 rows. Your site reads this file. |
| `data/college_town_home_sales.xlsx`, `.sqlite`, `.duckdb`, `.parquet` | The same data in Excel, SQLite, DuckDB and Parquet formats, with identical values |
| `docs/data_description_sheet.md` | What every column means, and five problems in the data |
| `AGENTS.md` | Project instructions for your AI coding agent |
| `AGENT_LOG.md` | Your agent log |
| `scripts/` | Scripts that make smaller data files for the site |
| `.github/workflows/pages.yml` | Publishes the site to GitHub Pages each time you push to main. It publishes your files as they are. If you switch to a framework that needs a build step, have your agent update it. |

Don't edit any of the five dataset files. Your site needs only the CSV file. The other formats make it easier to check numbers a second way, for example with a pivot table in Excel or a SQL query on the SQLite file. In SQLite and DuckDB, the table is named `home_sales`.

## What this site is for

A presentation-style dashboard for anyone comparing home prices in U.S. college towns: pick a town or campus area on the map, see its price distribution, and answer nine questions (budget, distance to campus, bedrooms, price per sq ft, trends, mean vs. median, features, construction year, seasonality), each with its own filters.

## Live site

https://jiisuuann.github.io/campustown-home-sales-claude/ (after the Part 2 pull request is merged)

## Data notes

- **Price rule:** every figure uses sales priced $10,000 to $5,000,000 (35,371 of 35,442). The 40 sales under $10,000 (down to $0) and 31 over $5,000,000 (up to $81.5M) are the implausible prices the description sheet flags.
- **Living area:** price per sq ft and the living-area filters skip sales with a blank or 0 sq ft living area.
- **Dates:** months, quarters and years come from `sale_date` (closing date). Sales run from 2023-03-27 to 2026-03-25, so 2023 and 2026 are partial years and are marked as such.
- **Features:** a blank basement or fireplace value is "not reported" and is kept out of both the with and without groups.
- **Small groups:** groups with fewer than 10 sales are shown faded and never chosen as an answer.
- `home_type` is not used. Repeated street addresses are kept (rows are keyed by `listing_id`).
- **Rebuilding the data file:** `python3 scripts/build_dashboard_data.py` (standard library only) rewrites `data/dashboard_sales.json` from the CSV.

## Tools we used

Claude Code (AI coding agent). D3 7.9.0, topojson-client 3.1.0 and us-atlas 3.0.1 (U.S. Census state boundaries), loaded from `vendor/`. Python standard library for the data script; pandas and Playwright were used only to check numbers and screenshots, not by the site.

## Citation

College-town home sales dataset, version 1.0 (2026). University of Illinois-Deloitte Foundation Center for Business Emerging Technologies. Data collected March 2026.

## Who did what

_For teams: replace this line with each member's name and what they did. If you worked alone, delete this section._
