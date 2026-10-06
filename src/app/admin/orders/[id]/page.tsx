import { notFound } from "next/navigation";
import Link from "next/link";
import Header from "@/components/Header";
import { ORDER_SQL, OrderView, type OrderRow } from "@/components/OrderView";
import { advanceOrder } from "@/app/actions/orders";
import { requireAdmin } from "@/lib/auth";
import { one } from "@/lib/db";
import { audit } from "@/lib/audit";
import { NEXT_STATUS, STATUS_LABEL } from "@/lib/format";

export default async function AdminOrder({ params }: PageProps<"/admin/orders/[id]">) {
  const admin = await requireAdmin();
  const { id } = await params;
  const order = await one<OrderRow>(ORDER_SQL, [Number(id) || 0]);
  if (!order) notFound();
  await audit(admin.id, "view", "order", order.id);
  const next = NEXT_STATUS[order.status];
  return (
    <>
      <Header current="/admin" />
      <main className="wrap">
        <div className="ph">
          <div><h1>Order {order.number}</h1><p className="muted"><Link href={`/admin/clinics/${order.clinic_id}`}>{order.clinic_name}</Link></p></div>
        </div>
        {next && (
          <form action={advanceOrder} className="card inline-form" style={{ maxWidth: "none", marginBottom: 16 }}>
            <input type="hidden" name="id" value={order.id} />
            <input type="hidden" name="status" value={next} />
            {next === "shipped" && (
              <label htmlFor="tracking" style={{ flex: "1 1 260px" }}>Tracking number<input id="tracking" name="tracking" placeholder="e.g. 1Z..." /></label>
            )}
            <button className="btn primary">Mark {STATUS_LABEL[next].toLowerCase()}</button>
            <span className="hint" style={{ flexBasis: "100%" }}>
              {order.status === "submitted" ? "Place each pharmacy's items in that pharmacy's portal, then mark the order sent." : next === "shipped" ? "The clinic gets an email with the tracking number." : ""}
            </span>
          </form>
        )}
        <OrderView order={order} admin />
        {order.status !== "cancelled" && order.status !== "delivered" && (
          <form action={advanceOrder} style={{ marginTop: 16 }}>
            <input type="hidden" name="id" value={order.id} />
            <input type="hidden" name="status" value="cancelled" />
            <button className="btn small">Cancel this order</button>
          </form>
        )}
      </main>
    </>
  );
}
