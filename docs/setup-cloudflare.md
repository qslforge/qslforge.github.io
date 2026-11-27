# Opzet Cloudflare

Deze handleiding maakt het Cloudflare-account, de database, de opslag, de Worker en de login. Reken op 30 minuten. Doe eerst `docs/setup-github.md` stap 1 tot 3.

Waarom deze opzet: de app (met login) en de API draaien samen op één adres, `qslforge.<subdomein>.workers.dev`, achter Cloudflare Access. Zo stuurt de browser de login-cookie altijd mee, ook in Safari op iPhone en in privémodus. Alleen `/api/public/*` is publiek: die routes gebruikt de site op `qslforge.github.io` voor verificatie en afmelden.

## 0. Benodigdheden op je pc

- Node.js 22 of hoger: <https://nodejs.org> (LTS-installer).
- pnpm: open een terminal en voer `corepack enable` uit. Controleer met `pnpm -v`.
- In de projectmap één keer: `pnpm install`.

## 1. Apart Cloudflare-account

1. Ga naar <https://dash.cloudflare.com/sign-up> en maak een nieuw account met je e-mailadres (het account van Diana blijft apart).
2. Bevestig je e-mailadres via de mail van Cloudflare.
3. Ga links naar **Workers & Pages**. Cloudflare vraagt een **workers.dev-subdomein**. Kies `qslforge` als dat vrij is. Je Worker komt dan op `https://qslforge.qslforge.workers.dev`. Noteer het subdomein: dat heb je nodig in stap 7.

## 2. Wrangler aanmelden

In de terminal, in de map `worker`:

```powershell
cd worker
pnpm exec wrangler login
```

Er opent een browservenster. Kies het nieuwe QSLforge-account en klik **Allow**. Controleer met `pnpm exec wrangler whoami` dat het juiste account getoond wordt.

## 3. D1-database aanmaken

```powershell
pnpm exec wrangler d1 create qslforge --location weur
```

`weur` plaatst de database in West-Europa (GDPR). De uitvoer toont een blok met `database_id`. Kopieer die waarde en vervang in `worker/wrangler.jsonc` de tekst `REPLACE_WITH_D1_DATABASE_ID`.

Pas daarna de migraties toe:

```powershell
pnpm db:migrate:remote
```

Typ `y` als Wrangler om bevestiging vraagt. Je ziet `0001_init.sql` en `0002_seed_programs.sql` met status ✅.

## 4. R2-bucket aanmaken

R2 moet één keer geactiveerd worden in het dashboard:

1. Dashboard, links **R2 Object Storage**, klik **Purchase R2 Plan** of **Get started**. Cloudflare kan hiervoor een betaalkaart vragen, ook voor het gratis plan; zolang je onder 10 GB blijft, betaal je niets. Doe dit zelf: ik vul geen betaalgegevens in.
2. Daarna in de terminal:

```powershell
pnpm exec wrangler r2 bucket create qslforge-files --location weur
```

De bucket is standaard privaat. Zet **geen** publieke toegang aan.

## 5. Geheimen instellen

```powershell
pnpm exec wrangler secret put IP_HASH_SALT
```

Wrangler vraagt de waarde. Plak een willekeurige reeks van minstens 32 tekens. Maak er een met:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Bewaar deze waarde nergens anders dan in je wachtwoordmanager.

## 6. Eerste deploy

Vul eerst in `worker/wrangler.jsonc` bij `vars`:

- `OWNER_EMAIL`: het e-mailadres waarmee je straks inlogt via Access.
- `OWNER_CALL`: `ON3VZ` (staat al goed).

`ACCESS_TEAM_DOMAIN` en `ACCESS_AUD` vul je in stap 7. Bouw en deploy nu:

```powershell
cd ..
pnpm build
cd worker
pnpm exec wrangler deploy
```

De Worker staat online, maar zonder Access antwoordt `/api/me` met 401 (geen token). Dat is correct.

## 7. Cloudflare Access aanzetten

### 7a. Login op de hele Worker

1. Dashboard, **Workers & Pages**, klik op de Worker **qslforge**.
2. Tab **Settings**, onderdeel **Domains & Routes**.
3. Bij de regel **workers.dev** klik je **Enable Cloudflare Access**.
4. Er verschijnt een venster met twee waarden: **TEAM_DOMAIN** (vorm `https://<team>.cloudflareaccess.com`) en **POLICY_AUD**. Kopieer beide naar `worker/wrangler.jsonc`: `ACCESS_TEAM_DOMAIN` en `ACCESS_AUD`.
5. Klik **Manage Cloudflare Access**. Open de policy van de applicatie en zet bij **Include**, selector **Emails**, alleen je eigen adres (hetzelfde als `OWNER_EMAIL`). Verwijder een eventuele regel die een heel domein toelaat. Klik **Save**.
6. Bij **Login methods** is **One-time PIN** standaard actief: je krijgt bij elke login een code per mail. Wil je met GitHub of Google inloggen, voeg die dan toe via **Zero Trust**, **Integrations**, **Identity providers** (optioneel).

### 7b. Publieke routes vrijgeven

1. Ga naar **Zero Trust** (links in het dashboard), **Access controls**, **Applications**, **Add an application**, kies **Self-hosted**.
2. **Application name:** `qslforge-public`.
3. **Destinations**, **Public hostname**: subdomain `qslforge`, domain `qslforge.workers.dev` (jouw subdomein uit stap 1), **Path:** `api/public/*`.
4. Policy toevoegen: naam `public-bypass`, **Action: Bypass**, **Include**, selector **Everyone**.
5. Opslaan. Omdat dit pad specifieker is dan de applicatie uit 7a, gaat het voor.

### 7c. Opnieuw deployen

```powershell
pnpm exec wrangler deploy
```

### 7d. Publieke site koppelen

Vervang in `site/assets/config.js` de tekst `REPLACE_SUBDOMAIN` door je subdomein, commit en push. De Pages-workflow zet de site opnieuw online.

## 8. Test: fase 0 is klaar als dit werkt

1. Open `https://qslforge.<subdomein>.workers.dev/` in een privévenster. Je krijgt het Cloudflare Access-inlogscherm. Vul je e-mailadres in en daarna de code uit de mail.
2. Je ziet **Welkom, ON3VZ** met het label **owner**. De eerste login heeft je owner-account aangemaakt.
3. Open `https://qslforge.<subdomein>.workers.dev/api/public/health` in een ander privévenster, zonder in te loggen. Je krijgt `{"status":"ok",...}`, zonder inlogscherm.
4. Open `https://qslforge.<subdomein>.workers.dev/api/me` in een privévenster zonder login. Je krijgt het Access-inlogscherm, geen data.
5. Controleer het auditlog:

```powershell
pnpm exec wrangler d1 execute qslforge --remote --command "SELECT action, at FROM audit_log"
```

Je ziet één regel `user.bootstrap`.

## Lokaal ontwikkelen

```powershell
copy worker\.dev.vars.example worker\.dev.vars
pnpm --filter @qslforge/worker db:migrate:local
pnpm dev:worker
```

In een tweede terminal: `pnpm dev:web`, open <http://localhost:5173>. Lokaal word je automatisch aangemeld als `owner@example.com`. Die omzeiling werkt alleen met `ENVIRONMENT=development`; als ze ooit in productie actief zou staan, weigert de Worker elke aanvraag.
