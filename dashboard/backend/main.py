import io
import os
import re
import subprocess
import tempfile
import uuid
from pathlib import Path
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

from fastapi import Depends, FastAPI, File, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse
from pydantic import BaseModel
from starlette.middleware.sessions import SessionMiddleware

from auth import db as auth_db
from auth import sessions as auth_sessions
from auth.dependencies import AuthContext, require_role, require_session
from auth.oauth import get_oauth_client, parse_provider_profile
from auth.redirects import frontend_login_redirect
from auth.repository import AuthRepository
from service import AnalyticsRepository, RepositoryRegistry


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
    actor: Optional[str] = None
    reason: Optional[str] = None
    context: Optional[Dict[str, Any]] = None


class AutomationScheduleRequest(BaseModel):
    template_id: str
    country: str = "ALL"
    geography: str = "EU27_AVG"
    sector: str = "ALL"
    period: str = "latest"
    rrule: Optional[str] = None
    approved: bool = False
    actor: Optional[str] = None


_here = Path(__file__).resolve().parent
root_dir = Path(os.environ.get("WORKFORCEGUARD_ROOT", str(_here.parents[1] if len(_here.parents) > 1 else _here)))


def _legacy_internal_dir_has_real_files(internal_dir: Path) -> bool:
    if not internal_dir.is_dir():
        return False
    return any(child.name != ".gitkeep" for child in internal_dir.iterdir())


def _assert_legacy_data_already_migrated(root_dir: Path) -> None:
    """Refuse to start if pre-multi-tenant data still sits at the legacy
    global paths. migrate_to_tenant.py must move it under data/tenants/{id}/
    before this app can serve it correctly — RepositoryRegistry never reads
    these paths, so leaving them in place means real data silently goes
    unserved with no error, while the app appears to start up fine."""
    found = []

    internal_dir = root_dir / "data" / "internal"
    if _legacy_internal_dir_has_real_files(internal_dir):
        found.append(str(internal_dir))

    for relative_path in ("data/governance_events.sqlite", "data/automation_schedules.json"):
        path = root_dir / relative_path
        if path.exists():
            found.append(str(path))

    if found:
        raise RuntimeError(
            "Found pre-migration data at legacy global path(s): "
            + ", ".join(found)
            + ". Run `python migrate_to_tenant.py <admin_email> <admin_display_name> "
            "<tenant_name>` to move it into a tenant before starting the app."
        )


if os.environ.get("WORKFORCEGUARD_SKIP_MIGRATION_CHECK") != "1":
    _assert_legacy_data_already_migrated(root_dir)

repository_registry = RepositoryRegistry(root_dir)


def get_repository(ctx: AuthContext = Depends(require_session)) -> AnalyticsRepository:
    return repository_registry.get_for_tenant(ctx.tenant_id)

app = FastAPI(title="WorkforceGuard Analytics API")

app.add_middleware(SessionMiddleware, secret_key=os.environ["SESSION_SECRET"])

_KNOWN_PRODUCTION_ORIGINS = {
    "https://workforceguard-ai.vercel.app",
    "https://workforceguardai.souravamseekar.com",
}
_raw_origins = os.environ.get("CORS_ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:3000")
_configured_origins = {o.strip() for o in _raw_origins.split(",") if o.strip()}
_allowed_origins = sorted(_configured_origins | _KNOWN_PRODUCTION_ORIGINS)

_VALID_ORIGIN_PATTERN = re.compile(
    r"^https://[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)*$"
    r"|^http://localhost(?::\d+)?$"
)

_invalid_origins = [origin for origin in _allowed_origins if not _VALID_ORIGIN_PATTERN.match(origin)]
if _invalid_origins:
    raise RuntimeError(
        "CORS_ALLOWED_ORIGINS contains invalid entries: "
        + ", ".join(_invalid_origins)
        + ". Each origin must be an exact https:// origin with no wildcards "
        "(or http://localhost[:port] for local development)."
    )

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
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


@app.get("/api/auth/login/{provider}")
async def auth_login(provider: str, request: Request):
    if provider not in ("google", "microsoft"):
        return RedirectResponse(url=frontend_login_redirect("unsupported_provider"))
    try:
        client = get_oauth_client(provider)
        redirect_uri = f"{os.environ['OAUTH_REDIRECT_BASE_URL']}/api/auth/callback/{provider}"
        return await client.authorize_redirect(request, redirect_uri)
    except ValueError:
        return RedirectResponse(url=frontend_login_redirect("unsupported_provider"))
    except Exception:  # pragma: no cover - OAuth misconfiguration or upstream outage
        return RedirectResponse(url=frontend_login_redirect("sign_in_unavailable"))


@app.get("/api/auth/callback/{provider}")
async def auth_callback(provider: str, request: Request):
    if provider not in ("google", "microsoft"):
        return RedirectResponse(url=frontend_login_redirect("unsupported_provider"))

    oauth_error = request.query_params.get("error")
    if oauth_error:
        error_code = "cancelled" if oauth_error == "access_denied" else "sign_in_failed"
        return RedirectResponse(url=frontend_login_redirect(error_code))

    try:
        client = get_oauth_client(provider)
        token = await client.authorize_access_token(request)
        userinfo = token.get("userinfo") or await client.userinfo(token=token)
        provider_subject, email, display_name = parse_provider_profile(provider, userinfo)

        pool = await auth_db.get_pool()
        repo = AuthRepository(pool)

        user = await repo.find_user_by_oauth(provider, provider_subject)
        if user is None:
            user = await repo.find_or_create_user(email, display_name)
            await repo.link_oauth_identity(user.id, provider, provider_subject)

        memberships = await repo.list_memberships_for_user(user.id)
        if not memberships:
            slug = email.split("@")[1].split(".")[0] + "-" + str(uuid.uuid4())[:8]
            tenant = await repo.create_tenant_with_admin(
                name=email.split("@")[1], slug=slug, user_id=user.id
            )
            tenant_id = tenant.id
        else:
            tenant_id = memberships[0].tenant_id

        session_id = str(uuid.uuid4())
        expires_at = datetime.now(timezone.utc) + timedelta(days=7)
        async with pool.acquire() as conn:
            await conn.execute(
                "insert into sessions (id, user_id, tenant_id, expires_at) values ($1, $2, $3, $4)",
                session_id,
                user.id,
                tenant_id,
                expires_at,
            )

        response = RedirectResponse(url=frontend_login_redirect())
        token_value = auth_sessions.create_session_token(session_id, expires_at)
        response.set_cookie(
            key=auth_sessions.SESSION_COOKIE_NAME,
            value=token_value,
            httponly=True,
            secure=True,
            samesite="lax",
            max_age=int((expires_at - datetime.now(timezone.utc)).total_seconds()),
        )
        return response
    except Exception:  # pragma: no cover - token exchange or persistence failure
        return RedirectResponse(url=frontend_login_redirect("sign_in_failed"))


@app.post("/api/auth/logout")
async def auth_logout(request: Request):
    token = request.cookies.get(auth_sessions.SESSION_COOKIE_NAME)
    if token is not None:
        session_id = auth_sessions.verify_session_token(token)
        if session_id is not None:
            pool = await auth_db.get_pool()
            async with pool.acquire() as conn:
                await conn.execute("delete from sessions where id = $1", session_id)
    response = JSONResponse({"status": "logged_out"})
    response.delete_cookie(auth_sessions.SESSION_COOKIE_NAME)
    return response


@app.get("/api/auth/me")
async def auth_me(ctx: AuthContext = Depends(require_session)):
    return {"user_id": ctx.user_id, "tenant_id": ctx.tenant_id, "role": ctx.role}


@app.get("/")
def read_root():
    _, options = guarded(repository_registry.public_repository.resolve_filters)
    return {
        "status": "ok",
        "service": "WorkforceGuard Analytics API",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "supported_grains": options["supported_grains"],
        "available_actions": list(repository_registry.public_repository.governance_actions.values()),
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
    repo: AnalyticsRepository = Depends(get_repository),
):
    return guarded(
        repo.build_overview,
        country=country,
        geography=geography,
        sector=sector,
        period=period,
        benchmark_geography=benchmark_geography,
        benchmark_sector=benchmark_sector,
    )


@app.post("/api/ask")
def ask_dashboard(
    request: AskRequest,
    repo: AnalyticsRepository = Depends(get_repository),
):
    return guarded(
        repo.answer_question,
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
    repo: AnalyticsRepository = Depends(get_repository),
):
    return guarded(
        repo.build_evidence_pack,
        country=country,
        geography=geography,
        sector=sector,
        period=period,
        benchmark_geography=benchmark_geography,
        benchmark_sector=benchmark_sector,
    )


@app.get("/api/brief")
def get_executive_brief(
    country: str = "ALL",
    geography: str = "EU27_AVG",
    sector: str = "ALL",
    period: str = "latest",
    benchmark_geography: Optional[str] = None,
    benchmark_sector: Optional[str] = None,
    repo: AnalyticsRepository = Depends(get_repository),
):
    overview = guarded(
        repo.build_overview,
        country=country,
        geography=geography,
        sector=sector,
        period=period,
        benchmark_geography=benchmark_geography,
        benchmark_sector=benchmark_sector,
    )
    return overview["brief"]


@app.get("/api/automation")
def get_automation_center(
    country: str = "ALL",
    geography: str = "EU27_AVG",
    sector: str = "ALL",
    period: str = "latest",
    benchmark_geography: Optional[str] = None,
    benchmark_sector: Optional[str] = None,
    repo: AnalyticsRepository = Depends(get_repository),
):
    overview = guarded(
        repo.build_overview,
        country=country,
        geography=geography,
        sector=sector,
        period=period,
        benchmark_geography=benchmark_geography,
        benchmark_sector=benchmark_sector,
    )
    return overview["automation"]


@app.post("/api/automation/schedules")
def create_automation_schedule(
    request: AutomationScheduleRequest,
    repo: AnalyticsRepository = Depends(get_repository),
    ctx: AuthContext = Depends(require_role("admin")),
):
    payload = request.model_dump()
    payload["actor"] = ctx.user_id
    return guarded(repo.configure_automation_schedule, payload)


@app.get("/api/automation/schedules/{schedule_id}/run")
def get_scheduled_output(
    schedule_id: str,
    repo: AnalyticsRepository = Depends(get_repository),
    ctx: AuthContext = Depends(require_role("admin")),
):
    return guarded(repo.build_scheduled_output, schedule_id)


@app.post("/api/governance-events")
def post_governance_event(
    request: GovernanceEventRequest,
    repo: AnalyticsRepository = Depends(get_repository),
    ctx: AuthContext = Depends(require_role("admin")),
):
    return guarded(
        repo.record_governance_event,
        {
            "action_code": request.action_code,
            "target_type": request.target_type,
            "target_id": request.target_id,
            "actor": ctx.user_id,
            "reason": request.reason,
            "context": request.context,
        },
    )


@app.get("/api/governance-events")
def list_governance_events(repo: AnalyticsRepository = Depends(get_repository)):
    return guarded(repo.build_governance_payload)


@app.get("/api/unemployment")
def get_unemployment(
    geography: str = "EU27_AVG",
    period: str = "latest",
    repo: AnalyticsRepository = Depends(get_repository),
):
    overview = guarded(repo.build_overview, geography=geography, period=period)
    return overview["charts"]["unemployment_trend"]["series"]


@app.get("/api/employment")
def get_employment(
    geography: str = "EU27_AVG",
    period: str = "latest",
    repo: AnalyticsRepository = Depends(get_repository),
):
    overview = guarded(repo.build_overview, geography=geography, period=period)
    return overview["charts"]["employment_trend"]["series"]


@app.get("/api/vacancies")
def get_vacancies(
    geography: str = "EU27_AVG",
    sector: str = "ALL",
    period: str = "latest",
    repo: AnalyticsRepository = Depends(get_repository),
):
    overview = guarded(repo.build_overview, geography=geography, sector=sector, period=period)
    return overview["charts"]["vacancy_by_sector"]["series"]


@app.get("/api/gender_pay_gap")
def get_gender_pay_gap(
    geography: str = "EU27_AVG",
    sector: str = "ALL",
    period: str = "latest",
    repo: AnalyticsRepository = Depends(get_repository),
):
    overview = guarded(repo.build_overview, geography=geography, sector=sector, period=period)
    return overview["charts"]["pay_gap_by_sector"]["series"]


@app.get("/api/egapro-benchmark")
def get_egapro_benchmark(
    country: str = "FR",
    sector: str = "J",
    size_band: Optional[str] = None,
    year: Optional[int] = None,
    repo: AnalyticsRepository = Depends(get_repository),
):
    filters, _ = guarded(repo.resolve_filters, country, "EU27_AVG", sector, "latest")
    return guarded(repo._build_egapro_peer_benchmark, filters)


def _trigger_tenant_internal_dbt(repo: AnalyticsRepository, result: Dict[str, Any]) -> None:
    """Rebuild this tenant's internal dbt models after an upload."""
    analytics_dir = root_dir / "analytics"
    if not analytics_dir.exists() or repo.tenant_schema is None:
        return

    try:
        dbt_env = {**os.environ, "WORKFORCEGUARD_INTERNAL_PATH": str(repo.internal_data_dir)}
        subprocess.Popen(
            [
                "dbt",
                "run",
                "--project-dir",
                str(analytics_dir),
                "--profiles-dir",
                str(analytics_dir),
                "--select",
                "tag:internal",
                "--vars",
                f'{{"tenant_schema": "{repo.tenant_schema}"}}',
            ],
            cwd=str(root_dir),
            env=dbt_env,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        result["dbt_run"] = "triggered"
    except FileNotFoundError:
        result["dbt_run"] = "dbt not found in PATH — run manually"


async def _read_uploaded_csv(file: UploadFile) -> bytes:
    if file.content_type not in ("text/csv", "application/csv", "text/plain"):
        raise HTTPException(
            status_code=400,
            detail="Only CSV files are accepted. Please upload a .csv file.",
        )

    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(
            status_code=413,
            detail="File too large. Maximum upload size is 10MB.",
        )
    return content


@app.post("/api/upload/payroll")
async def upload_payroll(
    file: UploadFile = File(...),
    repo: AnalyticsRepository = Depends(get_repository),
    ctx: AuthContext = Depends(require_role("admin")),
):
    content = await _read_uploaded_csv(file)
    result = guarded(repo.ingest_uploaded_payroll, content)
    _trigger_tenant_internal_dbt(repo, result)
    return result


@app.post("/api/upload/job-architecture")
async def upload_job_architecture(
    file: UploadFile = File(...),
    repo: AnalyticsRepository = Depends(get_repository),
    ctx: AuthContext = Depends(require_role("admin")),
):
    content = await _read_uploaded_csv(file)
    result = guarded(repo.ingest_uploaded_job_architecture, content)
    _trigger_tenant_internal_dbt(repo, result)
    return result


if __name__ == "__main__":
    import uvicorn

    host = os.getenv("WORKFORCEGUARD_HOST", "127.0.0.1")
    port = int(os.getenv("WORKFORCEGUARD_PORT", "8001"))
    uvicorn.run(app, host=host, port=port)
