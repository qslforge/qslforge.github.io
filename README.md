# QSLforge

Activation, QSL card and QSL mailing platform for portable amateur radio activations (POTA, WWFF/ONFF, SOTA, BOTA, COTA). Built and maintained by ON3VZ as a volunteer project, running entirely on free plans.

Status: **phase 0, foundation**.

## Architecture

| Part      | Where                                                           | What                                           |
| --------- | --------------------------------------------------------------- | ---------------------------------------------- |
| `web/`    | Cloudflare Worker static assets on `qslforge.<sub>.workers.dev` | Authenticated app (Preact + Vite + TypeScript) |
| `worker/` | Cloudflare Worker, same hostname                                | API (Hono), D1 database, R2 files              |
| `shared/` | Library                                                         | Shared types, later the ADIF/Cabrillo parser   |
| `site/`   | GitHub Pages on `qslforge.github.io`                            | Public pages: home, privacy, `/verify/<code>`  |
| `docs/`   |                                                                 | Setup and user guides                          |

App and API share one origin behind Cloudflare Access, so the login cookie is always first-party (works in Safari, iOS and private browsing). Only `/api/public/*` bypasses Access; it serves the public site with CORS for `https://qslforge.github.io` only, without credentials.

Every API request is authenticated twice: Cloudflare Access at the edge, then the Worker verifies the Access JWT (`Cf-Access-Jwt-Assertion`, issuer and audience checked) and looks the e-mail address up in `users`. The first login with `OWNER_EMAIL` creates the owner account.

## Free plan limits (checked 2026-11-27)

| Service             | Free limit                                                                                                        | Source                                                                                                                                   |
| ------------------- | ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Workers             | 100,000 requests/day, 10 ms CPU per request, 50 subrequests, 128 MB memory, 5 cron triggers                       | [Workers limits](https://developers.cloudflare.com/workers/platform/limits/)                                                             |
| Static assets       | Free and unlimited requests                                                                                       | [Static assets billing](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/)                                |
| D1                  | 10 databases, 500 MB per database, 5 GB total, 5M rows read/day, 100k rows written/day, 50 queries per invocation | [D1 limits](https://developers.cloudflare.com/d1/platform/limits/), [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/) |
| R2                  | 10 GB-month storage, 1M Class A and 10M Class B operations/month, free egress                                     | [R2 pricing](https://developers.cloudflare.com/r2/pricing/)                                                                              |
| Queues              | 10,000 operations/day, 24 h retention                                                                             | [Queues pricing](https://developers.cloudflare.com/queues/platform/pricing/)                                                             |
| Access (Zero Trust) | 50 users                                                                                                          | [Zero Trust plans](https://www.cloudflare.com/plans/sase-zero-trust/)                                                                    |

Design consequences: card, map and social image rendering happens in the browser (10 ms CPU per request is too little for image work in the Worker). Mail sending runs through a queue or cron that respects the provider's daily limit.

## Development

```sh
corepack enable
pnpm install
pnpm build          # web/dist is also needed by the Worker tests
pnpm check          # format, lint, typecheck, tests
```

Local dev: see `docs/setup-cloudflare.md`, section "Lokaal ontwikkelen".

## Privacy (GDPR) in a public repository

- No real logs, photos, call signs from real QSOs or e-mail addresses in git. `.gitignore` blocks `*.adi`, `*.cbr`, `*.log`, images and `.dev.vars`.
- Test fixtures use fictitious calls only (`shared/src/logparser/fixtures/README.md`).
- CI runs gitleaks with extra rules for e-mail addresses and ADIF records (`.gitleaks.toml`).
- Secrets exist only as Worker secrets (`wrangler secret put`).

## License

MIT
