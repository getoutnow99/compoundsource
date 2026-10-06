"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { one, pool } from "@/lib/db";
import { requireAdmin, requireClinic } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { appUrl, sendEmail } from "@/lib/email";
import { NEXT_STATUS, US_STATES } from "@/lib/format";

export type OrderState = { errors?: Record<string, string>; message?: string };

const Patient = z.object({
  patient_first: z.string().trim().min(1, "Enter a first name"),
  patient_last: z.string().trim().min(1, "Enter a last name"),
  patient_dob: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a date of birth")
    .refine((d) => new Date(d) <= new Date() && new Date(d) > new Date("1900-01-01"), "Check the date of birth"),
  patient_street: z.string().trim().min(1, "Enter a street address"),
  patient_city: z.string().trim().min(1, "Enter a city"),
  patient_state: z.string().trim().toUpperCase().refine((v) => US_STATES.includes(v), "Pick a state"),
  patient_zip: z.string().trim().regex(/^\d{5}(-\d{4})?$/, "Use 5 digits, e.g. 33511"),
  patient_phone: z.string().trim().optional(),
  patient_allergies: z.string().trim().optional(),
  prescriber_id: z.coerce.number().int().positive("Pick the prescriber"),
  ship_to: z.enum(["patient", "clinic"]),
  notes: z.string().trim().max(2000).optional(),
});
const Items = z.array(z.object({ id: z.number().int(), qty: z.number().int().min(1).max(999), pharmacy: z.string().nullable() })).min(1, "Add at least one medication");

const MAX_FILE = 10 * 1024 * 1024;

export async function submitOrder(_: OrderState, form: FormData): Promise<OrderState> {
  const user = await requireClinic();
  const p = Patient.safeParse(Object.fromEntries([...form.entries()].filter(([, v]) => typeof v === "string")));
  let items: z.infer<typeof Items> = [];
  const errors: Record<string, string> = {};
  if (!p.success) for (const i of p.error.issues) errors[String(i.path[0])] ??= i.message;
  try {
    const parsed = Items.safeParse(JSON.parse(String(form.get("items") || "[]")));
    if (parsed.success) items = parsed.data;
    else errors.items = parsed.error.issues[0].message;
  } catch {
    errors.items = "Add at least one medication";
  }
  const files = form.getAll("rx_files").filter((f): f is File => f instanceof File && f.size > 0);
  for (const f of files) if (f.size > MAX_FILE) errors.rx_files = `${f.name} is over 10 MB.`;
  if (!p.success || Object.keys(errors).length) return { errors, message: "Some details need fixing." };

  const d = p.data;
  const prescriber = await one("select id from prescribers where id = $1 and clinic_id = $2", [d.prescriber_id, user.clinic_id]);
  if (!prescriber) return { errors: { prescriber_id: "Pick a prescriber on your account" } };

  const client = await pool.connect();
  let orderId: number, number: string;
  try {
    await client.query("begin");
    const { rows } = await client.query(
      `insert into orders (clinic_id, created_by, prescriber_id, patient_first, patient_last, patient_dob, patient_street, patient_city,
         patient_state, patient_zip, patient_phone, patient_allergies, ship_to, notes)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) returning id, number`,
      [user.clinic_id, user.id, d.prescriber_id, d.patient_first, d.patient_last, d.patient_dob, d.patient_street, d.patient_city,
       d.patient_state, d.patient_zip, d.patient_phone || null, d.patient_allergies || null, d.ship_to, d.notes || null],
    );
    ({ id: orderId, number } = rows[0]);
    for (const it of items) {
      // Price comes from the database, never from the browser.
      const price = it.pharmacy
        ? await client.query("select price from medication_prices where medication_id = $1 and pharmacy_id = $2", [it.id, it.pharmacy])
        : null;
      const priced = price?.rows[0];
      await client.query("insert into order_items (order_id, medication_id, qty, pharmacy_id, unit_price) values ($1,$2,$3,$4,$5)", [
        orderId, it.id, it.qty, priced ? it.pharmacy : null, priced ? priced.price : null,
      ]);
    }
    for (const f of files)
      await client.query("insert into order_files (order_id, filename, mime, data) values ($1,$2,$3,$4)", [
        orderId, f.name, f.type || "application/octet-stream", Buffer.from(await f.arrayBuffer()),
      ]);
    await client.query("commit");
  } catch (e) {
    await client.query("rollback").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
  await audit(user.id, "create", "order", orderId);
  if (process.env.ADMIN_NOTIFY_EMAIL)
    await sendEmail(process.env.ADMIN_NOTIFY_EMAIL, `New order ${number} from ${user.clinic_name}`, `${user.clinic_name} submitted order ${number}.\n\n${appUrl(`/admin/orders/${orderId}`)}`);
  redirect(`/orders/${orderId}?new=1`);
}

export async function advanceOrder(form: FormData) {
  const admin = await requireAdmin();
  const id = Number(form.get("id"));
  const tracking = String(form.get("tracking") || "").trim() || null;
  const o = await one<{ status: string; number: string; contact_email: string }>(
    "select o.status, o.number, c.contact_email from orders o join clinics c on c.id = o.clinic_id where o.id = $1",
    [id],
  );
  if (!o) return;
  const next = String(form.get("status") || NEXT_STATUS[o.status] || "");
  if (!["sent", "shipped", "delivered", "cancelled"].includes(next)) return;
  await pool.query("update orders set status = $2, tracking = coalesce($3, tracking), updated_at = now() where id = $1", [id, next, tracking]);
  await audit(admin.id, `status_${next}`, "order", id);
  if (next === "shipped")
    await sendEmail(o.contact_email, `Order ${o.number} has shipped`, `Your CompoundSource order ${o.number} has shipped.${tracking ? ` Tracking: ${tracking}` : ""}\n\n${appUrl(`/orders/${id}`)}`);
  revalidatePath(`/admin/orders/${id}`);
  revalidatePath("/admin");
}
