from __future__ import annotations

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from ..agent import AgentRequestValidationError, AgentServiceError, ResearchResponseValidationError, run_market_agent
from ..agent.clients import create_llm_client, get_market_agent_provider
from .context_loader import ReportContextLoadError, ReportContextNotFoundError, load_research_context
from .schemas import AgentRequest, ResearchResponse


app = FastAPI(title="CodeX MarketAgent API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5173", "http://localhost:5173"],
    allow_credentials=False,
    allow_methods=["POST", "OPTIONS"],
    allow_headers=["Content-Type"],
)
provider = get_market_agent_provider()
llm_client = create_llm_client(provider)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "llm": provider}


@app.post("/api/market-agent", response_model=ResearchResponse)
def market_agent(request: AgentRequest) -> dict:
    payload = request.model_dump() if hasattr(request, "model_dump") else request.dict()
    try:
        context = load_research_context(request.report_id)
        return run_market_agent(payload, context, llm_client)
    except ReportContextNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except (ReportContextLoadError, AgentRequestValidationError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except ResearchResponseValidationError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except AgentServiceError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
