# MarketAgent Architecture

Last reviewed: 2026-07-12

This document describes the current MarketAgent implementation in the repository. It distinguishes the active structured architecture from the legacy Agent server that still exists in the codebase.

## 1. Design Goals

MarketAgent is an AI Equity Research Workspace, not a general-purpose chat interface.

Its contract is designed around an analyst report with:

- Stance and confidence.
- Executive Summary.
- Key Drivers.
- Market Impact.
- Risk Factors.
- What To Watch.
- Evidence references.
- Explicit limitations.

The architecture keeps provider SDKs out of the service layer and keeps API keys out of the frontend.

## 2. Component Map

```text
frontend/src/pages/MarketAgentWorkspace.jsx
  |-- frontend/src/lib/agentContext.js
  |     `-- frontend/src/lib/researchSchema.js
  |-- frontend/src/lib/marketAgentClient.js
  |     |-- frontend/src/lib/marketAgentSchema.js
  |     |-- frontend/src/lib/agentRetrieval.js
  |     `-- frontend/src/lib/mockResearchResponse.js
  |
  `-- POST /api/market-agent
        `-- market_news_report/agent_api/app.py
              |-- agent_api/schemas.py
              |-- agent_api/context_loader.py
              |-- agent/clients/factory.py
              `-- agent/service.py
                    |-- agent/context_formatter.py
                    |-- agent/prompt_builder.py
                    |-- agent/interfaces.py
                    |-- agent/response_validator.py
                    `-- agent/clients/{mock,deepseek}.py
```

## 3. Contracts

### 3.1 AgentRequest v1

The frontend creates and FastAPI validates:

```json
{
  "question": "Why did NVIDIA fall today?",
  "report_id": "close:2026-07-10T00:49:08Z",
  "analysis_type": "company",
  "context_version": "v1"
}
```

Supported analysis types:

- `company`
- `sector`
- `macro`
- `market_summary`

The HTTP contract intentionally does not include the complete ResearchContext. The backend resolves it from `report_id`.

### 3.2 ResearchResponse

The shared logical response shape is:

```json
{
  "query": "",
  "analysis_type": "",
  "stance": "",
  "confidence": 0,
  "executive_summary": "",
  "key_drivers": [
    {
      "title": "",
      "direction": "mixed",
      "importance": 0,
      "analysis": "",
      "evidence_ids": []
    }
  ],
  "market_impact": {
    "equities": "",
    "sectors": [],
    "rates": "",
    "time_horizon": ""
  },
  "risk_factors": [
    {
      "title": "",
      "level": "medium",
      "analysis": "",
      "evidence_ids": []
    }
  ],
  "watch_next": [
    {
      "item": "",
      "why_it_matters": "",
      "evidence_ids": []
    }
  ],
  "evidence": [],
  "limitations": []
}
```

Frontend normalization lives in `frontend/src/lib/marketAgentSchema.js`. Backend HTTP validation lives in `market_news_report/agent_api/schemas.py`, and raw LLM validation lives in `market_news_report/agent/response_validator.py`.

## 4. Frontend Context Preparation

The active page receives the selected raw report from `App.jsx`.

```text
reportData
  -> buildResearchContext(reportData)
  -> buildAgentContext(reportData)
  -> canonical ResearchContext plus UI compatibility aliases
```

`buildAgentContext()` does not maintain an independent report parser. It delegates normalization to `buildResearchContext()` and adds:

- `has_data`
- `report_time`
- `market_summary`
- `top_signals`
- `source_count`
- `total_events`
- `market_sentiment`
- `dominant_theme`
- `top_sector`

These aliases support the current Workspace, status strip, evidence panel, and mock response.

## 5. Frontend Retrieval

`frontend/src/lib/agentRetrieval.js` executes before the API request is sent.

Inputs:

```text
question
analysis_type
ResearchContext
```

Output:

```json
{
  "relevant_events": [],
  "relevant_drivers": [],
  "relevant_risks": [],
  "relevant_themes": [],
  "relevance_score": 0
}
```

Retrieval behavior:

| Analysis type | Main retrieval focus |
| --- | --- |
| `company` | Company/ticker events, related sectors, linked drivers and risks |
| `sector` | Sector events, macro themes, drivers, and linked risks |
| `macro` | Macro themes, risks, policy/rates events, and macro drivers |
| `market_summary` | Highest-importance drivers, risks, events, and leading themes |

Limits are currently fixed at eight events, six drivers, six risks, and four themes. Market-summary retrieval uses impact, importance, and severity sorting. Other types use term matching plus item weight.

`buildRetrievedResearchContext()` converts retrieval output back into a compact context compatible with the existing mock generator. It preserves market state, snapshot, asset view, watch lists, and selected source records.

Important boundary: the retrieved context is not included in AgentRequest. It is currently used only by the frontend fallback path.

## 6. Frontend Request and Fallback Flow

`askMarketAgent()` performs:

```text
Validate question
  -> create AgentRequest
  -> retrieve relevant context
  -> build compact fallback context
  -> POST AgentRequest to configured endpoint
```

The endpoint is:

```text
VITE_MARKET_AGENT_API_URL
```

or, by default:

```text
/api/market-agent
```

On a successful HTTP response:

1. Parse JSON.
2. Normalize it against ResearchResponse.
3. Fill incomplete sections from the structured mock fallback when required.

On network, HTTP, or JSON failure:

1. Do not expose an exception to the Workspace.
2. Generate a structured ResearchResponse from the retrieved report context.

The fallback is report-grounded and does not use an API key.

## 7. FastAPI Layer

The structured API is `market_news_report/agent_api/app.py`.

Routes:

```text
GET  /health
POST /api/market-agent
```

The POST handler:

1. Validates AgentRequest with Pydantic.
2. Loads the report context by `report_id`.
3. Calls the provider-neutral Agent service.
4. Returns a Pydantic-validated ResearchResponse.

Error mapping:

| Condition | HTTP status |
| --- | --- |
| Report not found | 404 |
| Report load or request validation failure | 400 |
| Invalid LLM ResearchResponse | 502 |
| LLM service/provider failure | 503 |

CORS currently allows the local Vite origins `http://127.0.0.1:5173` and `http://localhost:5173`.

## 8. Backend Context Loader

`market_news_report/agent_api/context_loader.py`:

1. Reads `reports/latest.json` using UTF-8.
2. Produces explicit errors for missing files, invalid encoding, invalid JSON, or a non-object root.
3. Validates `report_id` against `latest` or the current report identifier.
4. Converts the report into the Python ResearchContext v1 shape.

The backend ResearchContext contains:

- market state and snapshot
- drivers
- risks
- events
- macro themes
- asset view
- watch lists
- sources

Current limitation: the loader does not map arbitrary historical report IDs to files in `reports/history/`.

## 9. Agent Core

`market_news_report/agent/service.py` is provider-neutral and has no FastAPI or SDK dependency.

Its execution sequence is:

```text
Validate AgentRequest
  -> format compact ResearchContext
  -> build institutional JSON-only prompt
  -> LLMClient.generate(prompt)
  -> validate raw ResearchResponse
  -> return structured dictionary
```

If no LLM client is injected, the service returns a valid neutral response with confidence zero and an explicit `LLM client not connected` limitation.

### 9.1 Context Formatter

`context_formatter.py` removes full article bodies, images, charts, history, and other unused report fields. Default limits are:

- 6 drivers
- 6 risks
- 4 macro themes
- 12 events
- 4 sources per event
- 6 watch items per group

This is size reduction, not question-aware retrieval.

### 9.2 Prompt Builder

The prompt requires:

- One raw JSON object.
- No Markdown or code fences.
- No chat-style answer.
- Confidence between zero and 100.
- Evidence IDs for drivers and risks when possible.
- No invented prices, events, sources, or catalysts.
- Explicit limitations when evidence is insufficient.

### 9.3 Response Validator

The validator checks:

- JSON parse validity.
- Object root.
- All required top-level fields.
- String fields.
- Numeric confidence and range.
- Array field types.
- Market-impact object shape.
- Object entries in driver, risk, watch, and evidence arrays.
- String-only limitations.

It intentionally rejects Markdown code fences.

## 10. LLM Client Abstraction

`LLMClient` is a runtime-checkable Python Protocol:

```python
def generate(prompt: str) -> str:
    ...
```

The service does not know which provider implements the interface.

### 10.1 Provider Factory

`MARKET_AGENT_PROVIDER` controls the implementation:

```text
mock      default
deepseek  real OpenAI-compatible DeepSeek client
```

Unsupported provider values produce an explicit configuration error.

### 10.2 Mock Client

The mock client parses the question, analysis type, and compact context from the prompt and returns deterministic valid ResearchResponse JSON. It is intended for local integration testing and performs no model inference.

### 10.3 DeepSeek Client

Configuration:

```text
DEEPSEEK_API_KEY             required for deepseek provider
DEEPSEEK_MODEL               optional, default deepseek-chat
DEEPSEEK_TIMEOUT_SECONDS     optional, default 30
```

The base URL is `https://api.deepseek.com/v1`.

The client handles:

- Missing API key.
- Empty model or prompt.
- Timeout.
- Connection and network errors.
- API status errors.
- General OpenAI SDK errors.
- Missing choices.
- Empty model content.

It returns raw model text. JSON parsing and validation remain the responsibility of Agent Core.

## 11. Active Structured Call Chain

When FastAPI is started directly, the complete intended chain is:

```text
MarketAgentWorkspace
  -> buildAgentContext
  -> createAgentRequest
  -> frontend retrieval for fallback context
  -> POST /api/market-agent
  -> Pydantic AgentRequest
  -> load reports/latest.json
  -> Python ResearchContext v1
  -> create_llm_client
  -> run_market_agent
  -> compact context
  -> JSON-only prompt
  -> MockLLMClient or DeepSeekClient
  -> raw model text
  -> ResearchResponse validator
  -> Pydantic ResearchResponse
  -> frontend response normalizer
  -> structured Workspace sections
```

## 12. Legacy Agent Path

`market_news_report/market_agent.py` still implements an older architecture:

- Builds `reports/market_context.json` with a smaller legacy schema.
- Uses `ThreadingHTTPServer` instead of FastAPI.
- Instantiates an OpenAI-compatible client directly.
- Returns `{ "answer": "string" }`.
- Does not use AgentRequest v1.
- Does not use ResearchResponse.
- Does not use the provider factory.
- Does not use Agent Core validation.

`main.py --agent-api` currently starts this legacy path.

Consequences:

- The documented structured FastAPI architecture is not selected by that CLI flag.
- The frontend sends extra AgentRequest fields that the legacy server ignores.
- The legacy `{answer}` response has no structured research content, so the frontend normalizer will generally use its structured mock fallback.

The FastAPI service must currently be started directly:

```powershell
uvicorn market_news_report.agent_api.app:app --host 127.0.0.1 --port 8765
```

## 13. Architectural Gaps

### 13.1 Backend retrieval

The backend should retrieve relevant context after loading the report and before formatting the prompt. This preserves the existing AgentRequest contract and avoids trusting client-selected evidence.

Recommended future flow:

```text
AgentRequest
  -> load full ResearchContext by report_id
  -> backend retrieve(question, analysis_type, context)
  -> compact retrieved context
  -> prompt
```

### 13.2 One startup path

The FastAPI app should become the only supported Agent HTTP server. The CLI should launch it, and the legacy string-answer server should be deprecated or removed after compatibility review.

### 13.3 Context parity

Use common JSON fixtures to verify that the frontend and backend ResearchContext normalizers produce compatible fields and IDs from the same legacy and current reports.

### 13.4 Evidence integrity

Tests should ensure that every `evidence_id` returned by a driver, risk, or watch item exists in the response evidence register or is explicitly omitted when evidence is unavailable.

### 13.5 Historical reports

Introduce a safe report registry or index-based resolver rather than translating arbitrary `report_id` strings directly into filesystem paths.

### 13.6 Provider initialization

Consider lazy provider creation or a controlled startup diagnostic so a missing DeepSeek key is reported clearly without making unrelated health checks impossible.

## 14. Recommended Verification Matrix

| Layer | Minimum verification |
| --- | --- |
| Frontend schema | Old and current payload normalization |
| Retrieval | Company, sector, macro, market summary, and no-match cases |
| Mock fallback | Valid ResearchResponse with empty and populated contexts |
| API schema | Valid request plus each invalid field |
| Context loader | Missing, malformed, non-UTF-8, latest, current ID, historical ID |
| Agent Core | No client, mock client, provider exception, invalid JSON |
| Response validation | Missing field, wrong array type, confidence bounds, code fences |
| Evidence | Driver/risk evidence IDs resolve correctly |
| DeepSeek | Timeout, status error, empty response, valid response |
| End to end | Workspace -> FastAPI -> Mock and Workspace -> FastAPI -> DeepSeek |

## 15. Configuration Summary

Frontend:

```text
VITE_MARKET_AGENT_API_URL     optional; defaults to /api/market-agent
```

Backend provider:

```text
MARKET_AGENT_PROVIDER         mock or deepseek; defaults to mock
```

DeepSeek:

```text
DEEPSEEK_API_KEY
DEEPSEEK_MODEL
DEEPSEEK_TIMEOUT_SECONDS
```

Development routing:

```text
Vite /api proxy -> http://127.0.0.1:8765
```
