import { useEffect, useState } from "preact/hooks";
import type { MeResponse } from "@qslforge/shared";
import { api, ApiRequestError, LOGOUT_URL } from "./api";

type State =
  | { kind: "loading" }
  | { kind: "ready"; me: MeResponse }
  | { kind: "error"; status: number; message: string };

export function App() {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    api
      .me()
      .then((me) => setState({ kind: "ready", me }))
      .catch((err: unknown) => {
        const status = err instanceof ApiRequestError ? err.status : 0;
        setState({ kind: "error", status, message: String((err as Error).message) });
      });
  }, []);

  return (
    <div class="shell">
      <header class="topbar">
        <span class="brand">
          QSL<span class="accent">forge</span>
        </span>
        {state.kind === "ready" && (
          <span class="who">
            {state.me.call} <span class="role">{state.me.role}</span>
            <a class="logout" href={LOGOUT_URL}>
              Afmelden
            </a>
          </span>
        )}
      </header>

      <main class="content">
        {state.kind === "loading" && <p>Laden...</p>}

        {state.kind === "ready" && (
          <section class="card">
            <h1>Welkom, {state.me.call}</h1>
            <p>
              Fase 0 werkt: je bent aangemeld via Cloudflare Access en de beveiligde API antwoordt.
            </p>
            <p class="muted">De modules voor activaties en log-import komen in fase 1.</p>
          </section>
        )}

        {state.kind === "error" && (
          <section class="card error">
            <h1>Geen toegang</h1>
            {state.status === 403 ? (
              <p>Je bent aangemeld, maar dit adres is geen geregistreerde QSLforge-gebruiker.</p>
            ) : state.status === 401 ? (
              <p>Je sessie is verlopen. Laad de pagina opnieuw om opnieuw aan te melden.</p>
            ) : (
              <p>De API is niet bereikbaar ({state.message}).</p>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
