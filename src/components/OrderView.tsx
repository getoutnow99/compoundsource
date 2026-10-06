import Link from "next/link";
import { query } from "@/lib/db";
import { STATUS_LABEL, fmtDate, fmtDob, money } from "@/lib/format";

export type OrderRow = {
  id: number; number: string; status: string; created_at: string; updated_at: string; tracking: string | null;
  patient_first: string; patient_last: string; patient_dob: string; patient_street: string; patient_city: string;
  patient_state: string; patient_zip: string; patient_phone: string | null; patient_allergies: string | null;
  ship_to: string; notes: string | null; clinic_id: number; clinic_name: string;
  prescriber_name: string | null; prescriber_title: string | null; prescriber_npi: string | null; prescriber_dea: string | null;
};

export const ORDER_SQL = `select o.*, c.name as clinic_name, p.full_name as prescriber_name, p.title as prescriber_title,
  p.npi as prescriber_npi, p.dea as prescriber_dea
  from orders o join clinics c on c.id = o.clinic_id left join prescribers p on p.id = o.prescriber_id where o.id = $1`;

export async function OrderView({ order, admin }: { order: OrderRow; admin?: boolean }) {
  const [items, files] = await Promise.all([
    query<{ name: string; unit: string; qty: number; unit_price: string | null; pharmacy: string | null; flags: string[] }>(
      `select m.name, m.unit, i.qty, i.unit_price, ph.name as pharmacy, m.flags from order_items i
         join medications m on m.id = i.medication_id left join pharmacies ph on ph.id = i.pharmacy_id
        where i.order_id = $1 order by ph.name nulls last, m.name`,
      [order.id],
    ),
    query<{ id: number; filename: string }>("select id, filename from order_files where order_id = $1", [order.id]),
  ]);
  const total = items.reduce((s, i) => s + (i.unit_price ? Number(i.unit_price) * i.qty : 0), 0);
  const quotes = items.filter((i) => i.unit_price == null).length;
  const byPharmacy = new Map<string, typeof items>();
  for (const i of items) byPharmacy.set(i.pharmacy ?? "Needs a quote", [...(byPharmacy.get(i.pharmacy ?? "Needs a quote") ?? []), i]);
  const o = order;
  return (
    <div className="review">
      <section className="card">
        <h2 style={{ fontSize: 18 }}>Patient</h2>
        <dl className="kv">
          <dt>Name</dt><dd>{o.patient_first} {o.patient_last}</dd>
          <dt>Date of birth</dt><dd>{fmtDob(o.patient_dob)}</dd>
          <dt>Address</dt><dd>{o.patient_street}<br />{o.patient_city}, {o.patient_state} {o.patient_zip}</dd>
          {o.patient_phone && <><dt>Phone</dt><dd>{o.patient_phone}</dd></>}
          <dt>Allergies</dt><dd>{o.patient_allergies || "None listed"}</dd>
          <dt>Prescriber</dt><dd>{o.prescriber_name}, {o.prescriber_title}{admin && <><br /><span className="srcs">NPI {o.prescriber_npi}{o.prescriber_dea ? ` · DEA ${o.prescriber_dea}` : ""}</span></>}</dd>
          <dt>Ship to</dt><dd>{o.ship_to === "patient" ? "Patient" : "Clinic"}</dd>
          {o.notes && <><dt>Notes</dt><dd>{o.notes}</dd></>}
          <dt>Prescription</dt>
          <dd>{files.length ? files.map((f) => <div key={f.id}><Link href={`/files/order/${f.id}`}>{f.filename}</Link></div>) : <span className="muted">None attached</span>}</dd>
        </dl>
      </section>
      <section className="cart" style={{ position: "static" }}>
        <h2>Medications</h2>
        {[...byPharmacy.entries()].map(([ph, rows]) => (
          <div key={ph} style={{ display: "grid", gap: 6 }}>
            <div className="srcs" style={{ fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em" }}>{ph}</div>
            {rows.map((i, k) => (
              <div className="cart-line" key={k}>
                <span>{i.name} <span className="muted">× {i.qty}</span><br /><span className="srcs">{i.unit}</span></span>
                <span className="mono">{money(i.unit_price == null ? null : Number(i.unit_price) * i.qty)}</span>
              </div>
            ))}
          </div>
        ))}
        <div className="total"><span>Total{quotes > 0 && <span className="srcs"> + {quotes} quote{quotes > 1 ? "s" : ""}</span>}</span><span className="mono">{money(total)}</span></div>
        <dl className="kv">
          <dt>Status</dt><dd><span className={`status s-${o.status}`}>{STATUS_LABEL[o.status]}</span></dd>
          <dt>Placed</dt><dd>{fmtDate(o.created_at)}</dd>
          {o.tracking && <><dt>Tracking</dt><dd className="mono">{o.tracking}</dd></>}
        </dl>
      </section>
    </div>
  );
}

export function OrdersTable({ orders, admin }: { orders: (Pick<OrderRow, "id" | "number" | "status" | "created_at" | "patient_first" | "patient_last" | "patient_dob" | "clinic_name"> & { total: string | null; pharmacies: string | null })[]; admin?: boolean }) {
  if (!orders.length) return <p className="empty">No orders yet.</p>;
  return (
    <div className="tablebox">
      <table>
        <thead><tr><th>Order</th>{admin && <th>Clinic</th>}<th>Patient</th><th className="hide-sm">Date</th><th className="hide-sm">Pharmacies</th><th className="num">Total</th><th>Status</th></tr></thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id}>
              <td><Link className="btn small mono" href={admin ? `/admin/orders/${o.id}` : `/orders/${o.id}`}>{o.number}</Link></td>
              {admin && <td>{o.clinic_name}</td>}
              <td>{o.patient_first} {o.patient_last}<div className="srcs">DOB {fmtDob(o.patient_dob)}</div></td>
              <td className="hide-sm mono">{fmtDate(o.created_at)}</td>
              <td className="hide-sm srcs">{o.pharmacies || "Quote"}</td>
              <td className="num mono">{money(o.total)}</td>
              <td><span className={`status s-${o.status}`}>{STATUS_LABEL[o.status]}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const ORDERS_LIST_SQL = (where: string) => `select o.id, o.number, o.status, o.created_at, o.patient_first, o.patient_last, o.patient_dob, c.name as clinic_name,
  (select sum(i.qty * i.unit_price) from order_items i where i.order_id = o.id) as total,
  (select string_agg(distinct ph.name, ', ') from order_items i join pharmacies ph on ph.id = i.pharmacy_id where i.order_id = o.id) as pharmacies
  from orders o join clinics c on c.id = o.clinic_id ${where} order by o.created_at desc limit 500`;
