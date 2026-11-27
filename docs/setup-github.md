# Opzet GitHub

Deze handleiding zet de organisatie, de repo en de GitHub-instellingen op. Reken op 15 minuten.

## 1. Organisatie aanmaken

1. Ga naar <https://github.com/account/organizations/new?plan=free>.
2. Kies het plan **Free**.
3. **Organization name:** `qslforge`. Contact e-mail: je eigen adres. Bij "This organization belongs to" kies je **My personal account**.
4. Klik **Next**, sla het uitnodigen van leden over met **Complete setup**.

## 2. Repo aanmaken

De repo moet `qslforge.github.io` heten, anders draait de publieke site niet op `https://qslforge.github.io/`.

1. Ga naar <https://github.com/organizations/qslforge/repositories/new>.
2. **Repository name:** `qslforge.github.io`.
3. **Public**. Vink niets aan bij "Initialize this repository" (geen README, geen .gitignore, geen licentie): die zitten al in de code.
4. Klik **Create repository**.

## 3. Code pushen

Pak `qslforge-fase0.zip` uit in een map naar keuze, bv. `C:\Projecten\qslforge`. Open daar een terminal (in Verkenner: rechtsklik in de map, **Openen in Terminal**) en voer uit:

```powershell
git init -b main
git add .
git commit -m "chore: phase 0 foundation"
git remote add origin https://github.com/qslforge/qslforge.github.io.git
git push -u origin main
```

Controleer vóór de commit met `git status` dat er geen `.adi`-, `.jpg`- of `.dev.vars`-bestand in de lijst staat. De `.gitignore` houdt die tegen, maar kijk het de eerste keer zelf na.

## 4. Beveiliging aanzetten

1. Repo, tab **Settings**, menu links **Advanced Security** (bij oudere layout: **Code security**).
2. Zet **Secret Protection** aan (secret scanning), en daaronder **Push protection** aan.
3. Zet **Dependabot alerts** aan.
4. Menu links **Branches**, klik **Add classic branch protection rule** (of **Add ruleset**): branch `main`, vink **Require status checks to pass** aan en kies de checks `check` en `secrets-and-personal-data` (ze verschijnen pas na de eerste CI-run).

## 5. GitHub Pages aanzetten

1. Repo, **Settings**, menu links **Pages**.
2. Bij **Build and deployment**, **Source**: kies **GitHub Actions**.
3. De workflow `Deploy public site to GitHub Pages` start bij elke push naar `site/`. Start hem de eerste keer manueel: tab **Actions**, workflow links aanklikken, **Run workflow**.
4. Na 1 tot 2 minuten staat de site op <https://qslforge.github.io/>.

## 6. Automatische deploy van de Worker (optioneel, na docs/setup-cloudflare.md)

Pas doen als de Worker één keer manueel gedeployed is.

1. Cloudflare dashboard, rechtsboven je profiel, **My Profile**, **API Tokens**, **Create Token**.
2. Kies het sjabloon **Edit Cloudflare Workers**. Voeg bij **Permissions** toe: **Account**, **D1**, **Edit**. Beperk **Account Resources** tot je QSLforge-account. Klik **Continue to summary**, **Create Token** en kopieer de token (je ziet hem maar één keer).
3. Je account-ID vind je in het dashboard op **Workers & Pages**, rechts onder **Account details**.
4. GitHub repo, **Settings**, **Secrets and variables**, **Actions**:
   - Tab **Secrets**, **New repository secret**: `CLOUDFLARE_API_TOKEN` met de token, en `CLOUDFLARE_ACCOUNT_ID` met het account-ID.
   - Tab **Variables**, **New repository variable**: `DEPLOY_ENABLED` met waarde `true`.

Vanaf dan deployt elke push naar `main` die `web/`, `worker/` of `shared/` raakt automatisch, nadat de tests geslaagd zijn.
