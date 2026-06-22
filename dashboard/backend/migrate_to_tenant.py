import shutil
import sys
from pathlib import Path

from auth import db
from auth.repository import AuthRepository


async def migrate(root_dir: Path, admin_email: str, admin_display_name: str, tenant_name: str) -> str:
    pool = await db.get_pool()
    await db.run_migrations(pool)
    repo = AuthRepository(pool)

    user = await repo.find_or_create_user(admin_email, admin_display_name)
    slug = tenant_name.lower().replace(" ", "-")
    existing = await repo.get_tenant_by_slug(slug)
    if existing is not None:
        return existing.id

    tenant = await repo.create_tenant_with_admin(name=tenant_name, slug=slug, user_id=user.id)
    tenant_dir = root_dir / "data" / "tenants" / tenant.id
    tenant_dir.mkdir(parents=True, exist_ok=True)

    legacy_internal = root_dir / "data" / "internal"
    if legacy_internal.exists():
        shutil.move(str(legacy_internal), str(tenant_dir / "internal"))

    legacy_governance = root_dir / "data" / "governance_events.sqlite"
    if legacy_governance.exists():
        shutil.move(str(legacy_governance), str(tenant_dir / "governance_events.sqlite"))

    legacy_automation = root_dir / "data" / "automation_schedules.json"
    if legacy_automation.exists():
        shutil.move(str(legacy_automation), str(tenant_dir / "automation_schedules.json"))

    return tenant.id


if __name__ == "__main__":
    import asyncio

    if len(sys.argv) != 4:
        print("Usage: python migrate_to_tenant.py <admin_email> <admin_display_name> <tenant_name>")
        sys.exit(1)

    root_dir = Path(__file__).resolve().parents[2]
    tenant_id = asyncio.run(migrate(root_dir, sys.argv[1], sys.argv[2], sys.argv[3]))
    print(f"Migrated existing data to tenant {tenant_id}")