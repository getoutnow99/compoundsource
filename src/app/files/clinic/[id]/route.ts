import { getUser } from "@/lib/auth";
import { one } from "@/lib/db";
import { audit } from "@/lib/audit";

// License copies uploaded at sign-up: the clinic itself and admins.
export async function GET(_: Request, ctx: RouteContext<"/files/clinic/[id]">) {
  const user = await getUser();
  if (!user) return new Response("Sign in first", { status: 401 });
  const { id } = await ctx.params;
  const f = await one<{ filename: string; mime: string; data: Buffer; clinic_id: number }>(
    "select filename, mime, data, clinic_id from clinic_documents where id = $1",
    [Number(id) || 0],
  );
  if (!f || (user.role !== "admin" && f.clinic_id !== user.clinic_id)) return new Response("Not found", { status: 404 });
  await audit(user.id, "download", "clinic_document", id);
  return new Response(new Uint8Array(f.data), {
    headers: {
      "Content-Type": f.mime,
      "Content-Disposition": `inline; filename="${f.filename.replace(/[^\w.\- ]/g, "_")}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
