from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


AnalysisType = Literal["company", "sector", "macro", "market_summary"]


class AgentRequest(BaseModel):
    question: str = Field(min_length=1)
    report_id: str = Field(min_length=1)
    analysis_type: AnalysisType
    context_version: Literal["v1"] = "v1"


class KeyDriver(BaseModel):
    title: str
    direction: str
    importance: float = Field(ge=0, le=100)
    analysis: str
    evidence_ids: list[str] = []


class MarketImpact(BaseModel):
    equities: str
    sectors: list[str]
    rates: str
    time_horizon: str


class RiskFactor(BaseModel):
    title: str
    level: str
    analysis: str
    evidence_ids: list[str] = []


class WatchItem(BaseModel):
    item: str
    why_it_matters: str
    evidence_ids: list[str] = []


class EvidenceItem(BaseModel):
    id: str
    title: str = ""
    source: str = ""
    sources: list[str] = []
    url: str = ""
    published_at: str = ""
    impact_score: float = Field(default=0, ge=0, le=100)
    sentiment_score: float = Field(default=0, ge=-1, le=1)


class ResearchResponse(BaseModel):
    query: str
    analysis_type: AnalysisType
    stance: str
    confidence: float = Field(ge=0, le=100)
    executive_summary: str
    key_drivers: list[KeyDriver]
    market_impact: MarketImpact
    risk_factors: list[RiskFactor]
    watch_next: list[WatchItem]
    evidence: list[EvidenceItem]
    limitations: list[str]
