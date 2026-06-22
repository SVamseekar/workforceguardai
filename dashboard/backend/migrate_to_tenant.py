import os
import shutil
import subprocess
import sys
from pathlib import Path

from auth import db
from auth.repository import AuthRepository
from service import tenant_schema_name


async def migrate(root_dir: Path, admin_email: str, admin_display_name: str, tenant_name: str) -> str:
    pool = await db.get_pool()
    await db.run_migrations(pool)
    repo = AuthRepository(pool)

    user = await repo.find_or_create_user(admin_email, admin_display_name)
    slug = tenant_name.lower().replace(" ", "-")
    existing = await repo.get_tenant_by_slug(slug)
    if existing is not None:
        tenant_id = existing.id
    else:
        tenant = await repo.create_tenant_with_admin(name=tenant_name, slug=slug, user_id=user.id)
        tenant_id = tenant.id

    tenant_dir = root_dir / "data" / "tenants" / tenant_id
    tenant_dir.mkdir(parents=True, exist_ok=True)

    legacy_internal = root_dir / "data" / "internal"
    moved_internal_data = legacy_internal.exists()
    if moved_internal_data:
        shutil.move(str(legacy_internal), str(tenant_dir / "internal"))

    legacy_governance = root_dir / "data" / "governance_events.sqlite"
    if legacy_governance.exists():
        shutil.move(str(legacy_governance), str(tenant_dir / "governance_events.sqlite"))

    legacy_automation = root_dir / "data" / "automation_schedules.json"
    if legacy_automation.exists():
        shutil.move(str(legacy_automation), str(tenant_dir / "automation_schedules.json"))

    if moved_internal_data:
        _rebuild_internal_models_for_tenant(root_dir, tenant_dir / "internal", tenant_id)

    return tenant_id


def _rebuild_internal_models_for_tenant(root_dir: Path, internal_dir: Path, tenant_id: str) -> None:
    """Model the migrated tenant's internal data into its own DuckDB schema
    immediately, so the bootstrap tenant doesn't silently show "no internal
    data available" until the next manual payroll upload. Without this, the
    legacy data the migration just moved would model into the shared default
    schema instead (or not get re-modeled at all), defeating the point of
    the migration."""
    analytics_dir = root_dir / "analytics"
    if not analytics_dir.exists():
        return

    dbt_env = {**os.environ, "WORKFORCEGUARD_INTERNAL_PATH": str(internal_dir)}
    subprocess.run(
        [
            "dbt",
            "run",
            "--select",
            "tag:internal",
            "--vars",
            f'{{"tenant_schema": "{tenant_schema_name(tenant_id)}"}}',
            "--profiles-dir",
            ".",
        ],
        cwd=str(analytics_dir),
        env=dbt_env,
        check=False,
    )


if __name__ == "__main__":
    import asyncio

    if len(sys.argv) != 4:
        print("Usage: python migrate_to_tenant.py <admin_email> <admin_display_name> <tenant_name>")
        sys.exit(1)

    root_dir = Path(__file__).resolve().parents[2]
    tenant_id = asyncio.run(migrate(root_dir, sys.argv[1], sys.argv[2], sys.argv[3]))
    print(f"Migrated existing data to tenant {tenant_id}")