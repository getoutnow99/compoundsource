import Header from "@/components/Header";
import { requireClinic } from "@/lib/auth";
import { one, query } from "@/lib/db";

export default async function Account() {
  const user = await requireClinic();
  const c = await one<Record<string, string | null>>("select * from clinics where id = $1", [user.clinic_id]);
  const prescribers = await query<{ id: number; full_name: string; title: string; npi: string; dea: string | null; state_license: string; license_state: string }>(
    "select * from prescribers where clinic_id = $1 order by id", [user.clinic_id]);
  return (
    <>
      <Header current="/account" />
      <main className="wrap">
        <div className="ph"><div><h1>{c?.name}</h1><p className="muted">Signed in as {user.name} ({user.email}). To change these details or add a prescriber, email us and we&apos;ll update your account.</p></div></div>
        <div className="review">
          <section className="card">
            <h2 style={{ fontSize: 18 }}>Clinic</h2>
            <dl className="kv">
              <dt>Address</dt><dd>{c?.street}<br />{c?.city}, {c?.state} {c?.zip}</dd>
              <dt>Phone</dt><dd>{c?.phone}</dd>
              <dt>Ship to</dt><dd>{c?.ship_method === "office" ? `Office: ${c?.ship_street}, ${c?.ship_city}, ${c?.ship_state} ${c?.ship_zip}` : "Patient"}</dd>
              <dt>Delivery day</dt><dd>{c?.delivery_day}</dd>
              <dt>Payment</dt><dd>{c?.payment_method === "card" ? "Credit card" : "Invoice"}</dd>
            </dl>
          </section>
          <section className="card">
            <h2 style={{ fontSize: 18 }}>Prescribers</h2>
            {prescribers.map((p) => (
              <div key={p.id}><b>{p.full_name}, {p.title}</b><div className="srcs">License {p.state_license} ({p.license_state}) · NPI {p.npi}{p.dea ? ` · DEA ${p.dea}` : ""}</div></div>
            ))}
          </section>
        </div>
      </main>
    </>
  );
}
