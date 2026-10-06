import Link from "next/link";
import Header from "@/components/Header";
import { ORDERS_LIST_SQL, OrdersTable } from "@/components/OrderView";
import { requireAdmin } from "@/lib/auth";
import { query } from "@/lib/db";
import { STATUS_LABEL } from "@/lib/format";

const FILTERS = ["open", "submitted", "sent", "shipped", "delivered", "cancelled", "all"];

export default async function AdminQueue({ searchParams }: PageProps<"/admin">) {
  await requireAdmin();
  const { status = "open" } = (await searchParams) as { status?: string };
  const where =
    status === "all" ? "" : status === "open" ? "where o.status in ('submitted','sent','shipped')" : "where o.status = $1";
  const orders = await query(ORDERS_LIST_SQL(where), where.includes("$1") ? [status] : []);
  const counts = await query<{ status: string; n: string }>("select status, count(*) n from orders group by status");
  const n = (s: string) => Number(counts.find((c) => c.status === s)?.n ?? 0);
  const [{ pending }] = await query<{ pending: string }>("select count(*) pending from clinics where status = 'pending'");
  return (
    <>
      <Header current="/admin" />
      <main className="wrap">
        <div className="ph"><div><h1>Order queue</h1><p className="muted">Open each new order, place it in the pharmacy&apos;s portal, then mark it sent.</p></div></div>
        {Number(pending) > 0 && <p className="notice" style={{ marginBottom: 16 }}><Link href="/admin/clinics">{pending} clinic sign-up{Number(pending) > 1 ? "s" : ""} waiting for review</Link></p>}
        <div className="stats">
          <div className="stat"><div className="l">New</div><div className="n">{n("submitted")}</div></div>
          <div className="stat"><div className="l">At pharmacy</div><div className="n">{n("sent")}</div></div>
          <div className="stat"><div className="l">In transit</div><div className="n">{n("shipped")}</div></div>
          <div className="stat"><div className="l">Delivered</div><div className="n">{n("delivered")}</div></div>
        </div>
        <nav className="tabs" style={{ marginBottom: 12 }}>
          {FILTERS.map((f) => (
            <Link key={f} className="tab" href={`/admin?status=${f}`} aria-current={status === f ? "page" : undefined} style={{ textDecoration: "none" }}>
              {f === "open" ? "Open" : f === "all" ? "All" : STATUS_LABEL[f]}
            </Link>
          ))}
        </nav>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <OrdersTable orders={orders as any} admin />
      </main>
    </>
  );
}
