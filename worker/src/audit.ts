import type { Env } from "./env";

export interface AuditEntry {
  userId: string | null;
  action: string;
  objectType?: string;
  objectId?: string;
  ip: string | null;
}

/** SHA-256 of salt + IP. The raw IP address is never stored. */
export async function hashIp(ip: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${ip}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function audit(env: Env, entry: AuditEntry): Promise<void> {
  const ipHash = entry.ip && env.IP_HASH_SALT ? await hashIp(entry.ip, env.IP_HASH_SALT) : null;
  await env.DB.prepare(
    "INSERT INTO audit_log (user_id, action, object_type, object_id, ip_hash) VALUES (?1, ?2, ?3, ?4, ?5)",
  )
    .bind(entry.userId, entry.action, entry.objectType ?? null, entry.objectId ?? null, ipHash)
    .run();
}
