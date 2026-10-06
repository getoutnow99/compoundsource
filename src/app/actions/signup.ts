"use server";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";
import { pool } from "@/lib/db";
import { clientIp, createSession } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { appUrl, sendEmail } from "@/lib/email";
import { US_STATES } from "@/lib/format";

export type SignupState = { errors?: Record<string, string>; message?: string; values?: Record<string, string> };

const req = (msg: string) => z.string().trim().min(1, msg);
const opt = z.string().trim().optional().transform((v) => v || null);
const state = z.string().trim().toUpperCase().refine((v) => US_STATES.includes(v), "Pick a state");
const zip = z.string().trim().regex(/^\d{5}(-\d{4})?$/, "Use 5 digits, e.g. 33511");
const phone = z.string().trim().regex(/^[\d\s().+-]{10,}$/, "Enter a phone number with area code");
const email = z.string().trim().toLowerCase().email("Enter a valid email");

const Clinic = z.object({
  name: req("Enter the clinic name"),
  street: req("Enter the street address"),
  city: req("Enter the city"),
  state,
  zip,
  phone,
  email,
  fax: opt,
  website: opt,
  office_hours: opt,
  emr_system: opt,
  ship_method: z.enum(["patient", "office"], { message: "Pick where orders ship" }),
  ship_street: opt,
  ship_city: opt,
  ship_state: opt,
  ship_zip: opt,
  delivery_day: z.enum(["Tue", "Wed", "Thu", "Fri"], { message: "Pick a delivery day" }),
  contact_name: req("Enter the practice contact"),
  contact_phone: phone,
  contact_email: email,
  payment_method: z.enum(["card", "invoice"], { message: "Pick a payment method" }),
  billing_name: req("Enter the billing name"),
  billing_street: req("Enter the billing street"),
  billing_city: req("Enter the billing city"),
  billing_state: state,
  billing_zip: zip,
  billing_email: email,
  agreement_name: req("Type your full name to sign"),
  agreement_title: opt,
  agree: z.literal("on", { message: "You need to accept the provider agreement" }),
  login_name: req("Enter your name"),
  login_email: email,
  password: z.string().min(12, "Use at least 12 characters"),
  password2: z.string(),
});

const Prescriber = z.object({
  full_name: req("Enter the prescriber's full name"),
  title: req("Pick a title"),
  state_license: req("Enter the state license number"),
  license_state: state,
  dea: z.string().trim().toUpperCase().refine((v) => !v || /^[A-Z]{2}\d{7}$/.test(v), "DEA numbers are 2 letters and 7 digits"),
  npi: z.string().trim().regex(/^\d{10}$/, "NPI numbers are 10 digits"),
});

const MAX_FILE = 8 * 1024 * 1024;
const OK_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/heic"];

export async function signup(_: SignupState, form: FormData): Promise<SignupState> {
  const raw: Record<string, string> = {};
  for (const [k, v] of form.entries()) if (typeof v === "string" && k !== "password" && k !== "password2") raw[k] = v;
  const errors: Record<string, string> = {};

  const c = Clinic.safeParse(Object.fromEntries([...form.entries()].filter(([, v]) => typeof v === "string")));
  if (!c.success) for (const i of c.error.issues) errors[String(i.path[0])] ??= i.message;
  if (form.get("password") !== form.get("password2")) errors.password2 = "The passwords don't match";
  if (c.success && c.data.ship_method === "office") {
    for (const [k, m] of [["ship_street", "Enter the office ship-to street"], ["ship_city", "Enter the city"], ["ship_zip", "Enter the ZIP"]])
      if (!c.data[k as "ship_street"]) errors[k] = m;
    if (!US_STATES.includes(String(c.data.ship_state || "").toUpperCase())) errors.ship_state = "Pick a state";
  }

  const count = Math.min(Number(form.get("prescriber_count") || 1), 8);
  const prescribers: z.infer<typeof Prescriber>[] = [];
  for (let i = 0; i < count; i++) {
    const p = Prescriber.safeParse({
      full_name: form.get(`p${i}_full_name`) ?? "",
      title: form.get(`p${i}_title`) ?? "",
      state_license: form.get(`p${i}_state_license`) ?? "",
      license_state: form.get(`p${i}_license_state`) ?? "",
      dea: form.get(`p${i}_dea`) ?? "",
      npi: form.get(`p${i}_npi`) ?? "",
    });
    if (p.success) prescribers.push(p.data);
    else for (const iss of p.error.issues) errors[`p${i}_${String(iss.path[0])}`] ??= iss.message;
  }

  const files = form.getAll("license_files").filter((f): f is File => f instanceof File && f.size > 0);
  if (!files.length) errors.license_files = "Upload a copy of each prescriber's license";
  for (const f of files) {
    if (f.size > MAX_FILE) errors.license_files = `${f.name} is over 8 MB. Upload a smaller scan.`;
    else if (!OK_TYPES.includes(f.type)) errors.license_files = `${f.name} isn't a PDF or photo. Upload a PDF, JPG or PNG.`;
  }

  if (c.success) {
    const taken = await pool.query("select 1 from users where email = $1", [c.data.login_email]);
    if (taken.rowCount) errors.login_email = "An account already uses this email. Sign in instead.";
  }

  if (Object.keys(errors).length || !c.success)
    return { errors, values: raw, message: "Some details need fixing. They're marked in red below." };

  const d = c.data;
  const ip = await clientIp();
  const client = await pool.connect();
  let userId: number;
  try {
    await client.query("begin");
    const { rows } = await client.query(
      `insert into clinics (name, street, city, state, zip, phone, email, fax, website, office_hours, emr_system,
         ship_method, ship_street, ship_city, ship_state, ship_zip, delivery_day, contact_name, contact_phone, contact_email,
         payment_method, billing_name, billing_street, billing_city, billing_state, billing_zip, billing_email,
         agreement_name, agreement_title, agreement_signed_at, agreement_ip)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,now(),$30)
       returning id`,
      [d.name, d.street, d.city, d.state, d.zip, d.phone, d.email, d.fax, d.website, d.office_hours, d.emr_system,
       d.ship_method, d.ship_street, d.ship_city, d.ship_state?.toUpperCase() ?? null, d.ship_zip, d.delivery_day,
       d.contact_name, d.contact_phone, d.contact_email, d.payment_method, d.billing_name, d.billing_street, d.billing_city,
       d.billing_state, d.billing_zip, d.billing_email, d.agreement_name, d.agreement_title, ip],
    );
    const clinicId = rows[0].id;
    for (const p of prescribers)
      await client.query(
        "insert into prescribers (clinic_id, full_name, title, state_license, license_state, dea, npi) values ($1,$2,$3,$4,$5,$6,$7)",
        [clinicId, p.full_name, p.title, p.state_license, p.license_state, p.dea || null, p.npi],
      );
    for (const f of files)
      await client.query("insert into clinic_documents (clinic_id, kind, filename, mime, data) values ($1,'license',$2,$3,$4)", [
        clinicId, f.name, f.type, Buffer.from(await f.arrayBuffer()),
      ]);
    const hash = await bcrypt.hash(String(form.get("password")), 12);
    const u = await client.query(
      "insert into users (email, password_hash, name, role, clinic_id) values ($1,$2,$3,'clinic',$4) returning id",
      [d.login_email, hash, d.login_name, clinicId],
    );
    userId = u.rows[0].id;
    await client.query("commit");
    await audit(userId, "signup", "clinic", clinicId);
    if (process.env.ADMIN_NOTIFY_EMAIL)
      await sendEmail(process.env.ADMIN_NOTIFY_EMAIL, `New clinic sign-up: ${d.name}`, `${d.name} (${d.city}, ${d.state}) signed up and is waiting for review.\n\n${appUrl(`/admin/clinics/${clinicId}`)}`);
  } catch (e) {
    await client.query("rollback").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
  await createSession(userId);
  redirect("/pending");
}
