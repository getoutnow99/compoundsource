import { notFound } from "next/navigation";
import Link from "next/link";
import Header from "@/components/Header";
import { setClinicStatus } from "@/app/actions/admin";
import { requireAdmin } from "@/lib/auth";
import { one, query } from "@/lib/db";
import { audit } from "@/lib/audit";
import { fmtDate } from "@/lib/format";

type Clinic = Record<string, string | null> & { id: number; status: string };

export default async function AdminClinic({ params }: PageProps<"/admin/clinics/[id]">) {
  const admin = await requireAdmin();
  const { id } = await params;
  const c = await one<Clinic>("select * from clinics where id = $1", [Number(id) || 0]);
  if (!c) notFound();
  const [prescribers, docs, users] = await Promise.all([
    query<{ id: number; full_name: string; title: string; state_license: string; license_state: string; dea: string | null; npi: string }>("select * from prescribers where clinic_id = $1 order by id", [c.id]),
    query<{ id: number; filename: string; created_at: string }>("select id, filename, created_at from clinic_documents where clinic_id = $1", [c.id]),
    query<{ name: string; email: string; last_login_at: string | null }>("select name, email, last_login_at from users where clinic_id = $1", [c.id]),
  ]);
  await audit(admin.id, "view", "clinic", c.id);
  const row = (label: string, value: React.ReactNode) => value ? <><dt>{label}</dt><dd>{value}</dd></> : null;
  return (
    <>
      <Header current="/admin/clinics" />
      <main className="wrap">
        <div className="ph"><div><h1>{c.name}</h1><p className="muted">Signed up {fmtDate(String(c.created_at))} · Status: <b>{c.status}</b></p></div></div>
        <form action={setClinicStatus} className="card inline-form" style={{ maxWidth: "none", marginBottom: 16 }}>
          <input type="hidden" name="id" value={c.id} />
          <label htmlFor="admin_notes" style={{ flex: "1 1 320px" }}>Internal notes<input id="admin_notes" name="admin_notes" defaultValue={c.admin_notes ?? ""} placeholder="e.g. Verified licenses on state board site" /></label>
          {c.status !== "approved" && <button className="btn primary" name="status" value="approved">Approve and email clinic</button>}
          {c.status !== "rejected" && <button className="btn" name="status" value="rejected">Reject</button>}
          {c.status !== "pending" && <button className="btn" name="status" value="pending">Move back to review</button>}
        </form>
        <div className="review">
          <section className="card">
            <h2 style={{ fontSize: 18 }}>Clinic</h2>
            <dl className="kv">
              {row("Address", <>{c.street}<br />{c.city}, {c.state} {c.zip}</>)}
              {row("Phone", c.phone)}{row("Fax", c.fax)}{row("Email", c.email)}{row("Website", c.website)}
              {row("Office hours", c.office_hours)}{row("EMR", c.emr_system)}
            </dl>
            <h2 style={{ fontSize: 18 }}>Order processing</h2>
            <dl className="kv">
              {row("Ship to", c.ship_method === "office" ? <>Office: {c.ship_street}, {c.ship_city}, {c.ship_state} {c.ship_zip}</> : "Patient (address per order)")}
              {row("Delivery day", c.delivery_day)}
              {row("Contact", <>{c.contact_name}<br />{c.contact_phone} · {c.contact_email}</>)}
            </dl>
            <h2 style={{ fontSize: 18 }}>Billing</h2>
            <dl className="kv">
              {row("Method", c.payment_method === "card" ? "Credit card (send secure card link)" : "Invoice")}
              {row("Name", c.billing_name)}
              {row("Address", <>{c.billing_street}<br />{c.billing_city}, {c.billing_state} {c.billing_zip}</>)}
              {row("Email", c.billing_email)}
            </dl>
            <h2 style={{ fontSize: 18 }}>Agreement</h2>
            <dl className="kv">
              {row("Signed by", `${c.agreement_name}${c.agreement_title ? `, ${c.agreement_title}` : ""}`)}
              {row("Signed", fmtDate(String(c.agreement_signed_at)))}
              {row("From IP", c.agreement_ip)}
            </dl>
          </section>
          <section className="card">
            <h2 style={{ fontSize: 18 }}>Prescribers</h2>
            {prescribers.map((p) => (
              <dl className="kv" key={p.id} style={{ paddingBottom: 8, borderBottom: "1px dashed var(--line)" }}>
                {row("Name", `${p.full_name}, ${p.title}`)}
                {row("License", `${p.state_license} (${p.license_state})`)}
                {row("NPI", <a href={`https://npiregistry.cms.hhs.gov/provider-view/${p.npi}`} target="_blank" rel="noreferrer">{p.npi}</a>)}
                {row("DEA", p.dea || "None given")}
              </dl>
            ))}
            <h2 style={{ fontSize: 18 }}>License copies</h2>
            {docs.length ? docs.map((d) => <div key={d.id}><Link href={`/files/clinic/${d.id}`}>{d.filename}</Link></div>) : <p className="empty">None uploaded</p>}
            <h2 style={{ fontSize: 18 }}>Logins</h2>
            {users.map((u) => <div key={u.email}>{u.name} · {u.email}<div className="srcs">{u.last_login_at ? `Last sign-in ${fmtDate(u.last_login_at)}` : "Never signed in"}</div></div>)}
          </section>
        </div>
      </main>
    </>
  );
}
