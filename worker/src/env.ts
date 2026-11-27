import type { Role } from "@qslforge/shared";

export interface Env {
  DB: D1Database;
  FILES: R2Bucket;
  ASSETS: Fetcher;

  ENVIRONMENT: "production" | "development";
  APP_VERSION: string;
  PUBLIC_SITE_ORIGIN: string;
  ACCESS_TEAM_DOMAIN: string;
  ACCESS_AUD: string;
  OWNER_EMAIL: string;
  OWNER_CALL: string;

  /** Secret: salt for hashing IP addresses in audit_log. */
  IP_HASH_SALT: string;
  /** Local development only: skip Access and log in as this address. */
  DEV_AUTH_EMAIL?: string;
}

export interface AuthUser {
  id: string;
  call: string;
  name: string | null;
  email: string;
  role: Role;
}

export interface AppVariables {
  user: AuthUser;
}

export type AppEnv = { Bindings: Env; Variables: AppVariables };
