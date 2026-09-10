# Security

WorkforceGuard handles workforce and payroll-related data. Treat secrets and
tenant data as compromised if they ever land in git history.

## Report a vulnerability

Do not open a public issue for security reports.

- GitHub: [Security advisories](https://github.com/SVamseekar/workforceguardai/security/advisories/new)
- Email: martisoura@gmail.com

## Secrets and credentials

- Never commit `.env` files, API keys, tokens, private keys, certificates, or
  service-account JSON.
- Copy from the templates listed in [`.env.example`](.env.example).
- CI uses GitHub Actions secrets. Do not print secrets in logs.
- If a secret is committed, rotate it. Adding it to `.gitignore` is not enough.

## Tenant and payroll data

- Real company data under `data/internal/` and `data/tenants/` is gitignored.
- Do not commit live payroll, HRIS, or tenant databases.
- Tracked files under `data/internal_raw/` are **demo** snapshots (`demo-v1`),
  not production tenant data.

## Automated checks

- Pre-commit: Gitleaks + private-key detection (see `.pre-commit-config.yaml`).
- CI: the same pre-commit file hooks on every pull request, plus Gitleaks
  on every pull request and push to `main`.
