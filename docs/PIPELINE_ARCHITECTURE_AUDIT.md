# v1 / v2 Pipeline Architecture Audit

Last reviewed: 2026-07-12

## 1. Scope and References

This audit compares the automation and data-generation architecture stored in the following Git branches:

- v1 production branch: `main` at `c4c34b6`
- v2 release branch: `codex/v2-main` at `6ec4fee`

The comparison was performed with Git object reads and branch-to-branch diffs. Neither branch was checked out during the audit, and no business code was changed.

The files reviewed include:

- `.github/workflows/daily-news.yml`
- `.github/workflows/deploy.yml`
- `main.py`
- `market_news_report/pipeline.py`
- `market_news_report/analysis_schema.py`
- `market_news_report/llm.py`
- `market_news_report/report.py`
- `market_news_report/market_data.py`
- `market_news_report/media.py`
- `market_news_report/site_generator.py`
- `frontend/scripts/sync-report-data.mjs`
- `frontend/src/lib/useReportData.js`
- v2 ResearchContext, Agent Core, and Agent API modules

## 2. Executive Summary

v1 and v2 are not two independent news pipelines. They share the same collection, normalization, event-intelligence, chart, email, PDF, scheduler, and model modules. v2 is an additive evolution of the v1 pipeline with:

- pre-market and close report modes;
- stricter JSON and UTF-8 validation;
- richer report metadata and macro research fields;
- typed and indexed report history;
- improved market-data and image fallbacks;
- ResearchContext and page ViewModels;
- MarketAgent context generation and a separate FastAPI Agent runtime;
- a simplified static-branch GitHub Pages deployment model.

The long-term recommendation is to maintain one canonical generation pipeline, using the v2 schema as a backward-compatible superset. If the v1 interface must remain online, it should consume a v1 compatibility projection from the same generated report rather than continue running a separate fetch/LLM pipeline.

There is also an important current automation constraint: the workflow stored on `codex/v2-main` explicitly checks out `main` and pushes to `main`. It therefore does not currently update the v2 branch independently. It is structured to replace the production workflow after v2 is promoted to `main`, not to operate as a permanent parallel v2 pipeline.

## 3. GitHub Actions Comparison

### 3.1 v1 automation

The v1 `daily-news.yml` runs:

- manually through `workflow_dispatch`; or
- once on weekdays at `21:30 UTC`, after the regular US cash-session close.

Its flow is:

```text
Checkout main
  -> Python 3.11 and pip dependencies
  -> Node 20 and npm ci
  -> python main.py
  -> npm run build
  -> git add reports/ site/
  -> commit and push main
```

v1 also contains a separate `deploy.yml`:

```text
Push to main
  -> npm ci
  -> npm run build
  -> upload-pages-artifact
  -> actions/deploy-pages
```

This means v1 has two build/deployment mechanisms:

1. `daily-news.yml` generates and commits the site.
2. `deploy.yml` rebuilds and deploys a Pages artifact after a push.

The duplication adds execution time and creates two places where frontend build behavior can diverge.

### 3.2 v2 automation

The v2 `daily-news.yml` adds:

- manual report-type selection;
- a pre-market schedule at `12:30 UTC`;
- a close schedule at `22:00 UTC`;
- `REPORT_TYPE` selection based on trigger;
- full Git history checkout;
- optional `PAGES_PUSH_TOKEN` use;
- explicit static-site verification;
- controlled staging of canonical reports and `site/`;
- report-type-specific commit messages.

Its flow is:

```text
Checkout main
  -> select premarket or close
  -> install Python and Node dependencies
  -> python main.py with REPORT_TYPE
  -> npm run build
  -> verify site/index.html
  -> stage canonical reports, history, root entry, and site/
  -> commit and push HEAD:main
```

v2 removes `deploy.yml` and expects GitHub Pages to serve committed static files through branch deployment. The root `index.html` enters `site/`, and `.nojekyll` disables Jekyll processing.

### 3.3 Current branch behavior

The workflow in `codex/v2-main` still contains:

```yaml
with:
  ref: main
```

and:

```bash
git push origin HEAD:main
```

Consequences:

- Scheduled production automation remains associated with the default branch rather than forming an independent v2 schedule.
- Manually running the v2 workflow does not create an isolated v2 data stream because it checks out `main`.
- The workflow is safe as a post-promotion production definition, but not as a long-term dual-version workflow.
- Running two workflows with the same concurrency group would also serialize or interfere with parallel v1/v2 jobs.

## 4. Python Pipeline Comparison

### 4.1 Shared base sequence

Both versions use the same fundamental pipeline:

```text
fetch_all_news
  -> source diagnostics
  -> dedupe_news
  -> enrich_items
  -> LLMAnalyzer.summarize_market
  -> enrich_analysis_with_sources
  -> update_market_data_files
  -> build news feed
  -> build and enrich market events
  -> rescore events
  -> score key events
  -> download event images
  -> build themes and defaults
  -> translate analysis
  -> save JSON
  -> build charts and Markdown
  -> PDF
  -> static site
  -> email and diagnostics
```

### 4.2 v1 pipeline behavior

v1 exposes `run_daily_job()` with no report-type argument.

Characteristics:

- one daily report mode;
- one weekday close-oriented schedule;
- LLM summarization without report-session context;
- a simpler report schema;
- JSON parsing that falls back to an empty object on malformed model JSON;
- direct UTF-8 text writes without strict serialization round-trip verification;
- one dated history file per day;
- `US_STOCK_DAILY_*` Markdown, JSON, and PDF names;
- no MarketAgent context generation.

v1 report persistence writes:

```text
reports/market_analysis.json
reports/latest.json
reports/history/YYYY-MM-DD.json
reports/market_analysis_YYYYMMDD_HHMMSS.json
```

### 4.3 v2 pipeline behavior

v2 changes the entry to:

```python
run_daily_job(report_type: str | None = None)
```

The report type is resolved from the explicit argument, `REPORT_TYPE`, or the close default.

Additional v2 stages and behavior:

1. Pass report type into LLM summarization.
2. Apply report metadata:
   - report type and label;
   - generated time;
   - market session;
   - source window;
   - data-freshness warning.
3. Validate the complete report before persistence.
4. Perform strict UTF-8 serialization and JSON round-trip checks.
5. Generate a compact legacy MarketAgent context file.
6. Use report-type-specific report names and email subjects.
7. Maintain typed latest reports and a history index.

v2 report persistence writes:

```text
reports/market_analysis.json
reports/latest.json
reports/premarket.json or reports/close.json
reports/history/YYYY-MM-DD-{report_type}.json
reports/market_analysis_{report_type}_YYYYMMDD_HHMMSS.json
reports/history_index.json
reports/market_context.json
```

## 5. Data Schema and LLM Differences

### 5.1 v1 report model

The v1 schema includes:

- dynamic headline;
- market summary and narrative;
- index, macro, and sentiment summaries;
- key drivers;
- sector/theme impact;
- watch items;
- market data;
- key events, news items, and news events;
- translations.

It is sufficient for the v1 dashboard and event-oriented experience but does not model a complete macro strategy research page or Agent research context.

### 5.2 v2 report model

v2 retains the v1 fields and adds a backward-compatible superset:

- report metadata and freshness state;
- structured market narrative;
- `macro_analysis.market_regime`;
- institutional macro themes with current view, change, significance, asset impact, and watch items;
- asset views for equities, rates, growth stocks, financials, and sectors;
- categorized macro, policy, and company watch lists;
- stronger translation validation;
- strict Unicode validation.

The v2 LLM prompt explicitly asks for sell-side macro research rather than a news recap. Its fallback analyzer also constructs structured macro analysis when the real model is unavailable.

### 5.3 Compatibility

v2's schema is designed as an extension rather than a replacement:

- legacy fields remain present;
- missing v2 fields receive defaults;
- frontend ResearchContext accepts current and legacy report shapes;
- v1 consumers can continue reading the common market summary, drivers, events, and market-data fields.

This makes a single v2 canonical pipeline technically preferable to two independent schema generators.

## 6. Market Data and Media Differences

### 6.1 Market data

v1 tracks SPY, QQQ, VIX, and the 10-year yield.

v2 changes the active set to SPY, QQQ, DIA as DOW, and VIX, and adds:

- fallback to the previous valid snapshot;
- fallback to historical series;
- stale-item markers and stale timestamps;
- snapshot status propagation;
- protection against appending stale points to history.

These are reliability improvements suitable for the shared pipeline. The symbol-set change is a product choice and should be confirmed before replacing v1 production behavior.

### 6.2 Media

v1 downloads images only from `key_events` with a simple per-event limit.

v2 adds:

- configurable maximum events and images;
- image discovery across key and news events;
- support for multiple image metadata fields and article-level images;
- duplicate image suppression;
- empty image-path fallback.

The v2 media behavior is also suitable for the shared pipeline because Event Feed is the intended image consumer.

## 7. Frontend Data Generation Comparison

### 7.1 v1 sync layer

The v1 sync script copies:

- latest or standard market analysis;
- trends and market history;
- legacy history reports;
- assets;
- generated manifest data.

It recognizes only `US_STOCK_DAILY_*` as the primary named-report family.

### 7.2 v2 sync layer

v2 extends the script to support:

- `premarket.json` and `close.json`;
- typed historical report names;
- the backend-generated `market_context.json`;
- report metadata in archive summaries;
- source `history_index.json` as the preferred index;
- removal of stale public history before copying current history;
- all `US_STOCK_*` report families;
- typed report links in the manifest.

The frontend data hook also changes from one fixed latest report to a selectable report source and builds the five-page architecture through `buildPageArchitecture()`.

### 7.3 ResearchContext

ResearchContext is a v2 frontend normalization layer, not part of the news-fetch pipeline itself.

Its flow is:

```text
canonical report JSON
  -> buildResearchContext(report)
  -> Macro Strategy ViewModel
  -> MarketAgent compatibility context
```

Dashboard and Event Feed still use `reportDerivedData.js`, while Macro Strategy and MarketAgent use ResearchContext. This is an incremental frontend migration and does not require a separate backend report run.

## 8. Agent Data Path

The v2 report pipeline creates `reports/market_context.json` through the retained legacy context builder. Separately, the structured FastAPI Agent API loads `reports/latest.json` and builds its own Python ResearchContext v1 before calling Agent Core.

Therefore there are two Agent-related data products:

1. `market_context.json`: compact legacy compatibility artifact generated during the daily pipeline.
2. Backend ResearchContext: generated on demand from `latest.json` for the structured FastAPI service.

The formal v2 Agent API does not require a second news fetch or a second market-report LLM analysis. It reuses the canonical report and performs a separate question-answering inference only when requested.

## 9. Modules That Can Be Shared

### 9.1 Already identical across branches

The following files are byte-for-byte unchanged between `main` and `codex/v2-main` and should remain shared:

- `market_news_report/fetchers.py`
- `market_news_report/processing.py`
- `market_news_report/intelligence.py`
- `market_news_report/models.py`
- `market_news_report/charts.py`
- `market_news_report/emailer.py`
- `market_news_report/pdf_exporter.py`
- `market_news_report/scheduler.py`

These modules form the stable collection and event-intelligence core.

### 9.2 Shared concepts with v2 improvements

The following should also converge into one implementation, using v2 behavior after regression testing:

- `config.py`: shared environment and output settings.
- `market_data.py`: shared market-data fetch and stale fallback.
- `media.py`: shared image enrichment and deduplication.
- `analysis_schema.py`: one versioned, backward-compatible schema.
- `llm.py`: one prompt system with report-type modes.
- `report.py`: one renderer with typed report metadata.
- `site_generator.py`: one build wrapper and fallback renderer.
- `pipeline.py`: one orchestrator accepting report mode.
- `frontend/scripts/sync-report-data.mjs`: one typed-report publisher.

### 9.3 v2-only modules

The following should remain optional extensions around the shared core rather than be copied into a v1 fork:

- frontend ResearchContext and page architecture;
- Macro Strategy ViewModel and page;
- MarketAgent Workspace and retrieval;
- `market_news_report/agent/`;
- `market_news_report/agent_api/`.

## 10. Should the Pipelines Be Unified?

Yes. The data-generation pipeline should be unified.

Reasons:

1. The expensive and failure-prone stages are already the same: fetching, deduplication, scoring, market data, and base LLM analysis.
2. Running separate v1 and v2 pipelines doubles source traffic, model cost, generated commits, and operational failure points.
3. The v2 schema is a compatible superset of v1 rather than a mutually exclusive format.
4. v2 adds validation and stale-data handling that improve v1 reliability as well.
5. The frontend differences belong in adapters and presentation layers, not separate collection pipelines.
6. Two scheduled jobs writing different report formats to the same repository would create race conditions around `latest.json`, `history_index.json`, `site/`, and generated assets.

The pipelines should not be unified by immediately deleting v1 code or forcing both frontends to use every v2 field. They should be unified around a versioned canonical report and explicit compatibility outputs.

Recommended canonical model:

```text
One collection and analysis run
  -> Canonical v2 report schema
  -> v2 ResearchContext consumer
  -> optional v1 compatibility projection
  -> version-specific static publish targets
```

## 11. Long-Term v1 / v2 Maintenance Plan

### Phase A: Short-term parallel validation

Keep:

- `main` as the production v1 branch;
- `codex/v2-main` as the release-candidate branch.

Do not enable two workflows that both push to `main`.

For v2 shadow validation:

- use a manually triggered workflow or a separate schedule;
- checkout the triggering ref rather than hard-coded `main`;
- use a distinct concurrency group;
- write outputs to artifacts or an isolated preview branch/path;
- never overwrite production `reports/latest.json` or `site/` from the shadow run;
- compare event counts, top-event ranking, report validity, build output, and data freshness with v1.

Suggested ownership:

| Concern | v1 production | v2 shadow |
| --- | --- | --- |
| News sources | Same configuration | Same configuration |
| Output branch | `main` | isolated preview/ref |
| Latest report | production `latest.json` | preview artifact |
| Site | production `site/` | preview artifact/site |
| Schedule | current production | manual or non-overlapping |
| Provider secrets | production secrets | same secret names, isolated run |

### Phase B: Promote the canonical pipeline

After v2 shadow validation:

1. Tag the final v1 state, for example `v1.x-final`.
2. Merge or fast-forward the reviewed v2 release into `main` using an explicit release procedure.
3. Replace the production workflow with the v2 `daily-news.yml`.
4. Confirm branch-based Pages settings and PAT behavior.
5. Run one manual pre-market and one manual close workflow.
6. Verify typed reports, history index, static site, and root redirect.
7. Create the `v2.0.0` tag only after production smoke validation.

### Phase C: Maintain v1 as compatibility, not a second pipeline

If users still require the v1 interface:

- keep a `v1-maintenance` branch or immutable v1 tag;
- accept only critical security and production fixes;
- do not continue adding schema features to v1;
- render v1 from the canonical v2 report through a compatibility adapter;
- avoid a second fetch and LLM report generation job;
- publish v1 to a separate path only if continued access is required.

### Phase D: Consolidate shared contracts

Add explicit version metadata:

```json
{
  "schema_version": "2.0",
  "context_version": "v1"
}
```

Then add fixture-based tests for:

- legacy v1 report loading in the v2 validator;
- canonical v2 report generation;
- v1 compatibility projection;
- frontend ResearchContext normalization;
- backend ResearchContext normalization;
- pre-market and close history naming;
- static sync and manifest generation.

## 12. Operational Risks to Resolve

### 12.1 Hard-coded production branch

The v2 workflow currently checks out and pushes `main`. This must be intentional at promotion time and must not be reused unchanged for parallel preview automation.

### 12.2 Shared output collisions

Premarket, close, market-data scheduler, and any v1 compatibility job can all update shared canonical files. Use workflow concurrency and clear ownership of:

- `latest.json`;
- typed reports;
- history index;
- market snapshot/history/trends;
- `site/`.

### 12.3 Duplicate build systems

v1 uses both committed-site generation and `actions/deploy-pages`. v2 selects committed static branch deployment. Production should use one approach only.

### 12.4 Schema drift

Do not maintain separate v1 and v2 copies of event normalization and scoring. Keep one schema validator with legacy input compatibility and versioned output expectations.

### 12.5 Agent context duplication

The legacy `market_context.json` and the structured API's on-demand ResearchContext have different purposes. Document or eventually retire the legacy artifact after confirming no deployed v1 consumer requires it.

## 13. Recommended Target Architecture

```text
GitHub Actions scheduler
  -> report mode selection
  -> shared collection core
     -> fetchers
     -> processing
     -> intelligence
     -> market data
     -> media
  -> shared LLM report analyzer
  -> canonical versioned report validator
  -> canonical reports
     -> latest
     -> premarket / close
     -> history and index
  -> publish adapters
     -> v2 React static site
     -> optional v1 compatibility site
  -> on-demand Agent API
     -> latest/history context loader
     -> ResearchContext
     -> Agent Core
     -> Mock / DeepSeek provider
```

This keeps news and market analysis generation deterministic and centralized while allowing version-specific user interfaces and optional Agent capabilities.

## 14. Final Recommendation

Do not operate v1 and v2 as permanently separate end-to-end pipelines.

Use a short shadow-validation period, then promote the v2 pipeline to `main` as the single production generator. Preserve v1 through a tag or maintenance branch and, if necessary, a compatibility renderer that consumes the same canonical reports.

Before promotion:

1. Create an isolated v2 preview workflow or perform manual shadow runs.
2. Validate pre-market and close output against v1 production data quality.
3. Confirm the intended market-symbol change, especially removal of the 10-year yield and addition of DIA/DOW.
4. Confirm GitHub Pages branch deployment and token behavior.
5. Ensure only one workflow owns production report and site writes.
6. Add schema and sync fixtures for legacy and v2 reports.

After those checks, the v2 pipeline is the better canonical foundation because it retains the shared v1 core while adding stronger validation, typed report modes, richer research data, and optional Agent functionality.
