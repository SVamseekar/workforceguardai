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

### Evidence pack signing key

`WORKFORCEGUARD_EVIDENCE_SIGNING_KEY` is an Ed25519 private key (base64,
32-byte seed) used to sign every compliance evidence pack export. It is
app-managed — not a qualified electronic signature — and lives only in
this env var, never in DuckDB or any repo-tracked file.

Generate a new key:

```bash
cd dashboard/backend && .venv/bin/python -c "import evidence_signing; print(evidence_signing.generate_signing_key_b64())"
```

**Rotation:**
1. Generate a new key with the command above.
2. Deploy it as the new `WORKFORCEGUARD_EVIDENCE_SIGNING_KEY`.
3. Packs signed under the old key remain independently verifiable forever
   (each pack embeds its `signing_key_id`) — you do not need to keep the
   old private key after rotation, only be able to say which key id was
   retired and when.
4. Record the rotation as a governance event (`POST /api/governance-events`
   with `action_code=overridden`, `target_type=evidence_pack_signing_key`,
   a `reason`, so the governance log itself shows when keys changed.
5. If the old key may have leaked, treat every pack it ever signed as
   compromised, per the "if a secret is committed, rotate it" rule above.

## Tenant and payroll data

- Real company data under `data/internal/` and `data/tenants/` is gitignored.
- Do not commit live payroll, HRIS, or tenant databases.
- Tracked files under `data/internal_raw/` are **demo** snapshots (`demo-v1`),
  not production tenant data.

## Automated checks

- Pre-commit: Gitleaks + private-key detection (see `.pre-commit-config.yaml`).
- CI: the same pre-commit file hooks on every pull request, plus Gitleaks
  on every pull request and push to `main`.
