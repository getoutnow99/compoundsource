import { getUser } from "@/lib/auth";
import { one } from "@/lib/db";
import { audit } from "@/lib/audit";

// Prescription downloads: only the ordering clinic and admins.
export async function GET(_: Request, ctx: RouteContext<"/files/order/[id]">) {
  const user = await getUser();
  if (!user) return new Response("Sign in first", { status: 401 });
  const { id } = await ctx.params;
  const f = await one<{ filename: string; mime: string; data: Buffer; clinic_id: number; order_id: number }>(
    "select f.filename, f.mime, f.data, o.clinic_id, o.id as order_id from order_files f join orders o on o.id = f.order_id where f.id = $1",
    [Number(id) || 0],
  );
  if (!f || (user.role !== "admin" && f.clinic_id !== user.clinic_id)) return new Response("Not found", { status: 404 });
  await audit(user.id, "download", "order_file", id);
  return new Response(new Uint8Array(f.data), {
    headers: {
      "Content-Type": f.mime,
      "Content-Disposition": `inline; filename="${f.filename.replace(/[^\w.\- ]/g, "_")}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
