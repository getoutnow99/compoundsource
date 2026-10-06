import Link from "next/link";
import Header from "@/components/Header";
import { requireAdmin } from "@/lib/auth";
import { query } from "@/lib/db";
import { fmtDate } from "@/lib/format";

export default async function AdminClinics() {
  await requireAdmin();
  const clinics = await query<{ id: number; name: string; city: string; state: string; status: string; created_at: string; prescribers: string; orders: string }>(
    `select c.id, c.name, c.city, c.state, c.status, c.created_at,
            (select count(*) from prescribers p where p.clinic_id = c.id) prescribers,
            (select count(*) from orders o where o.clinic_id = c.id) orders
       from clinics c order by (c.status = 'pending') desc, c.created_at desc`,
  );
  const chip: Record<string, string> = { pending: "s-sent", approved: "s-delivered", rejected: "s-cancelled" };
  return (
    <>
      <Header current="/admin/clinics" />
      <main className="wrap">
        <div className="ph"><div><h1>Clinics</h1><p className="muted">Review new sign-ups, check licenses, then approve them to open ordering.</p></div></div>
        {clinics.length ? (
          <div className="tablebox">
            <table>
              <thead><tr><th>Clinic</th><th>Location</th><th className="num">Prescribers</th><th className="num">Orders</th><th className="hide-sm">Signed up</th><th>Status</th></tr></thead>
              <tbody>
                {clinics.map((c) => (
                  <tr key={c.id}>
                    <td><Link href={`/admin/clinics/${c.id}`}><b>{c.name}</b></Link></td>
                    <td>{c.city}, {c.state}</td>
                    <td className="num mono">{c.prescribers}</td>
                    <td className="num mono">{c.orders}</td>
                    <td className="hide-sm mono">{fmtDate(c.created_at)}</td>
                    <td><span className={`status ${chip[c.status]}`}>{c.status[0].toUpperCase() + c.status.slice(1)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="empty">No clinics have signed up yet. Share the sign-up link: /signup</p>}
      </main>
    </>
  );
}
