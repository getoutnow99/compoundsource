import { notFound } from "next/navigation";
import Header from "@/components/Header";
import { ORDER_SQL, OrderView, type OrderRow } from "@/components/OrderView";
import { requireClinic } from "@/lib/auth";
import { one } from "@/lib/db";
import { audit } from "@/lib/audit";

export default async function OrderPage({ params, searchParams }: PageProps<"/orders/[id]">) {
  const user = await requireClinic();
  const { id } = await params;
  const { new: isNew } = await searchParams;
  const order = await one<OrderRow>(ORDER_SQL, [Number(id) || 0]);
  if (!order || order.clinic_id !== user.clinic_id) notFound();
  await audit(user.id, "view", "order", order.id);
  return (
    <>
      <Header current="/orders" />
      <main className="wrap">
        <div className="ph"><div><h1>Order {order.number}</h1><p className="muted">{order.clinic_name}</p></div></div>
        {isNew && <p className="notice" style={{ marginBottom: 16 }}>Order {order.number} is submitted. We&apos;ll send it to the pharmacy and email you when it ships.</p>}
        <OrderView order={order} />
      </main>
    </>
  );
}
