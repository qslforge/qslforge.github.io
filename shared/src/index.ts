/**
 * Types shared between the web app and the Worker.
 * Keep this file free of runtime dependencies.
 */

export type Role = "owner" | "member";

export const PROGRAM_CODES = ["POTA", "WWFF", "SOTA", "BOTA", "COTA"] as const;
export type ProgramCode = (typeof PROGRAM_CODES)[number];

export type ActivationStatus = "draft" | "completed" | "published";

export type LogFormat = "ADIF" | "CABRILLO";

export type MailMessageStatus = "queued" | "sent" | "bounced" | "failed";

/** Response of GET /api/me */
export interface MeResponse {
  id: string;
  call: string;
  name: string | null;
  email: string;
  role: Role;
}

/** Response of GET /api/health */
export interface HealthResponse {
  status: "ok";
  version: string;
  db: "ok" | "error";
}

/** Uniform error body for every non-2xx API response */
export interface ApiError {
  error: string;
  message: string;
}
