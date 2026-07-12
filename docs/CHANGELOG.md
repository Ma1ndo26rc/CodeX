# Changelog

## v2.0.0 - AI Equity Research Platform

### Added

- ResearchContext unified architecture
  - Introduced a unified market research context layer with normalized market state, snapshot, drivers, risks, events, macro themes, asset views, watch items, and sources.
  - Unified the active research data flow used by Macro Strategy Analysis and MarketAgent while preserving a gradual migration path for Dashboard.
  - Added backward-compatible normalization and explicit empty-context fallbacks for legacy or incomplete reports.

- Macro Strategy Analysis
  - Upgraded the Macro page into a sell-side style macro strategy research view.
  - Added Market Regime, Macro Themes, Asset Transmission, Risk Monitor, and What Investors Watch Next.
  - Added strategist view, investment view, confidence, risk triggers, and categorized watch events.

- MarketAgent Research Workspace
  - Replaced chatbot-style output with a structured equity research workflow.
  - Added:
    - Executive Summary
    - Analyst View
    - Key Drivers
    - Market Impact
    - Risk Factors
    - What To Watch
    - Evidence Context and Evidence Register
  - Added structured mock fallback, session persistence, suggested research questions, and question-aware frontend context retrieval.

- FastAPI Agent Service
  - Added an independent Agent backend service with health and market-agent endpoints.
  - Introduced structured AgentRequest and ResearchResponse contracts.
  - Added report context loading, compact prompt context formatting, provider-neutral Agent Core orchestration, and strict model-response validation.

- DeepSeek Provider
  - Added a pluggable LLM provider architecture based on a provider-neutral client protocol.
  - Added DeepSeek OpenAI-compatible client support with model, timeout, network, API, and empty-response handling.
  - Kept the deterministic mock provider as the default for local development and integration testing.

### Changed

- Unified Agent API entry
  - Migrated the `python main.py --agent-api` CLI path to the FastAPI implementation.
  - Marked the CLI flag as a deprecated compatibility alias and added a migration message for direct uvicorn startup.
  - Retained the legacy HTTP server source for compatibility review, but removed it from the main CLI startup path.

- Updated project documentation
  - Reworked README around the v2 AI Equity Research Platform architecture.
  - Added frontend page responsibilities, ResearchContext, FastAPI Agent, Agent Core, provider, local setup, validation, and deployment documentation.
  - Added environment configuration examples and dedicated project-status and Agent-architecture documentation.

### Security

- Added safe environment configuration examples without real credentials.
- Ensured local `.env`, dependency directories, Python caches, editor state, and temporary files are excluded from version control.
- Removed the tracked `.cph` cache artifact from the Git index while retaining the local ignored file.
- Kept API keys out of frontend code and repository configuration.

### Validation

- Frontend production build passed with Vite.
- Python compile validation passed for the application, Agent modules, and tests.
- FastAPI Agent API health and structured response validation passed.
- Deprecated CLI alias startup was verified against the FastAPI health endpoint.
- Mock Agent workflow and structured evidence response were verified.
