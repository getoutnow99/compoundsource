"use server";
import { revalidatePath } from "next/cache";
import { one, query } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { appUrl, sendEmail } from "@/lib/email";

export async function setClinicStatus(form: FormData) {
  const admin = await requireAdmin();
  const id = Number(form.get("id"));
  const status = String(form.get("status"));
  if (!["approved", "rejected", "pending"].includes(status)) return;
  const notes = String(form.get("admin_notes") || "").trim() || null;
  await query("update clinics set status = $2, admin_notes = coalesce($3, admin_notes) where id = $1", [id, status, notes]);
  await audit(admin.id, `clinic_${status}`, "clinic", id);
  const c = await one<{ name: string; email: string }>(
    "select c.name, u.email from clinics c join users u on u.clinic_id = c.id where c.id = $1 order by u.id limit 1",
    [id],
  );
  if (c && status === "approved")
    await sendEmail(c.email, "Your CompoundSource account is approved", `${c.name} can now place orders.\n\nSign in: ${appUrl("/login")}`);
  revalidatePath(`/admin/clinics/${id}`);
  revalidatePath("/admin/clinics");
}
