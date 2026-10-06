import "server-only";
import { query } from "./db";
import { clientIp } from "./auth";

export async function audit(userId: number | null, action: string, entity: string, entityId?: string | number) {
  await query("insert into audit_log (user_id, action, entity, entity_id, ip) values ($1,$2,$3,$4,$5)", [
    userId,
    action,
    entity,
    entityId == null ? null : String(entityId),
    await clientIp(),
  ]);
}
