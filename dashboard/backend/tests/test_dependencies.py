# dashboard/backend/tests/test_dependencies.py
from __future__ import annotations

import os
import sys
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

ROOT_DIR = Path(__file__).resolve().parents[3]
BACKEND_DIR = ROOT_DIR / "dashboard" / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

os.environ.setdefault("SESSION_SECRET", "test-secret-not-for-production-use-only")

import asyncio
from datetime import datetime, timedelta, timezone

from auth import sessions
from auth.dependencies import AuthContext, require_role


class RequireRoleTests(unittest.TestCase):
    def test_admin_satisfies_member_requirement(self):
        ctx = AuthContext(user_id="u1", tenant_id="t1", role="admin")
        dependency = require_role("member")
        result = asyncio.run(dependency(ctx=ctx))
        self.assertEqual(result, ctx)

    def test_member_does_not_satisfy_admin_requirement(self):
        from fastapi import HTTPException

        ctx = AuthContext(user_id="u1", tenant_id="t1", role="member")
        dependency = require_role("admin")
        with self.assertRaises(HTTPException) as exc_info:
            asyncio.run(dependency(ctx=ctx))
        self.assertEqual(exc_info.exception.status_code, 403)