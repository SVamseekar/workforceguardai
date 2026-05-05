import os
from pathlib import Path
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from service import AnalyticsRepository


class AskRequest(BaseModel):
    question: str
    country: str = "ALL"
    geography: str = "EU27_AVG"
    sector: str = "ALL"
    period: str = "latest"
    benchmark_geography: Optional[str] = None
    benchmark_sector: Optional[str] = None


class GovernanceEventRequest(BaseModel):
    action_code: str
    target_type: str
    target_id: str
    reason: Optional[str] = None
    context: Optional[Dict[str, Any]] = None


root_dir = Path(__file__).resolve().parents[2]
repository = AnalyticsRepository(root_dir)

app = FastAPI(title="WorkforceGuard Analytics API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def guarded(callable_fn, *args, **kwargs):
    try:
        return callable_fn(*args, **kwargs)
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except Exception as error:  # pragma: no cover - safety net for runtime issues
        raise HTTPException(status_code=500, detail=str(error)) from error


@app.get("/")
def read_root():
    _, options = guarded(repository.resolve_filters)
    return {
        "status": "ok",
        "service": "WorkforceGuard Analytics API",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "supported_grains": options["supported_grains"],
        "available_actions": guarded(repository.build_governance_payload)["available_actions"],
    }


@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "WorkforceGuard Analytics API",
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/api/overview")
def get_overview(
    country: str = "ALL",
    geography: str = "EU27_AVG",
    sector: str = "ALL",
    period: str = "latest",
    benchmark_geography: Optional[str] = None,
    benchmark_sector: Optional[str] = None,
):
    return guarded(
        repository.build_overview,
        country=country,
        geography=geography,
        sector=sector,
        period=period,
        benchmark_geography=benchmark_geography,
        benchmark_sector=benchmark_sector,
    )


@app.post("/api/ask")
def ask_dashboard(request: AskRequest):
    return guarded(
        repository.answer_question,
        question=request.question,
        country=request.country,
        geography=request.geography,
        sector=request.sector,
        period=request.period,
        benchmark_geography=request.benchmark_geography,
        benchmark_sector=request.benchmark_sector,
    )


@app.get("/api/evidence-pack")
def get_evidence_pack(
    country: str = "ALL",
    geography: str = "EU27_AVG",
    sector: str = "ALL",
    period: str = "latest",
    benchmark_geography: Optional[str] = None,
    benchmark_sector: Optional[str] = None,
):
    return guarded(
        repository.build_evidence_pack,
        country=country,
        geography=geography,
        sector=sector,
        period=period,
        benchmark_geography=benchmark_geography,
        benchmark_sector=benchmark_sector,
    )


@app.post("/api/governance-events")
def create_governance_event(request: GovernanceEventRequest):
    return guarded(repository.record_governance_event, request.model_dump())


@app.get("/api/governance-events")
def list_governance_events():
    return guarded(repository.build_governance_payload)


@app.get("/api/unemployment")
def get_unemployment(
    geography: str = "EU27_AVG",
    period: str = "latest",
):
    overview = guarded(repository.build_overview, geography=geography, period=period)
    return overview["charts"]["unemployment_trend"]["series"]


@app.get("/api/employment")
def get_employment(
    geography: str = "EU27_AVG",
    period: str = "latest",
):
    overview = guarded(repository.build_overview, geography=geography, period=period)
    return overview["charts"]["employment_trend"]["series"]


@app.get("/api/vacancies")
def get_vacancies(
    geography: str = "EU27_AVG",
    sector: str = "ALL",
    period: str = "latest",
):
    overview = guarded(repository.build_overview, geography=geography, sector=sector, period=period)
    return overview["charts"]["vacancy_by_sector"]["series"]


@app.get("/api/gender_pay_gap")
def get_gender_pay_gap(
    geography: str = "EU27_AVG",
    sector: str = "ALL",
    period: str = "latest",
):
    overview = guarded(repository.build_overview, geography=geography, sector=sector, period=period)
    return overview["charts"]["pay_gap_by_sector"]["series"]


if __name__ == "__main__":
    import uvicorn

    host = os.getenv("WORKFORCEGUARD_HOST", "127.0.0.1")
    port = int(os.getenv("WORKFORCEGUARD_PORT", "8001"))
    uvicorn.run(app, host=host, port=port)
