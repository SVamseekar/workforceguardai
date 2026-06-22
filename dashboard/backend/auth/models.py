from dataclasses import dataclass


@dataclass(frozen=True)
class User:
    id: str
    email: str
    display_name: str


@dataclass(frozen=True)
class Tenant:
    id: str
    name: str
    slug: str


@dataclass(frozen=True)
class Membership:
    user_id: str
    tenant_id: str
    role: str