import Link from "next/link";
import Header from "@/components/Header";
import { ORDERS_LIST_SQL, OrdersTable } from "@/components/OrderView";
import { requireClinic } from "@/lib/auth";
import { query } from "@/lib/db";
import { audit } from "@/lib/audit";

export default async function MyOrders() {
  const user = await requireClinic();
  const orders = await query(ORDERS_LIST_SQL("where o.clinic_id = $1"), [user.clinic_id]);
  await audit(user.id, "view_list", "order", `clinic:${user.clinic_id}`);
  return (
    <>
      <Header current="/orders" />
      <main className="wrap">
        <div className="ph">
          <div><h1>My orders</h1><p className="muted">Track every order across all pharmacies in one place.</p></div>
          <Link className="btn primary" href="/order/new">New order</Link>
        </div>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <OrdersTable orders={orders as any} />
      </main>
    </>
  );
}
