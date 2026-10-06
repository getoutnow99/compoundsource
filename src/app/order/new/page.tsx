import Header from "@/components/Header";
import { requireClinic } from "@/lib/auth";
import { loadCatalog } from "@/lib/catalog";
import { one, query } from "@/lib/db";
import OrderWizard from "./OrderWizard";

export default async function NewOrderPage() {
  const user = await requireClinic();
  const [meds, prescribers, clinic] = await Promise.all([
    loadCatalog(),
    query<{ id: number; full_name: string; title: string }>("select id, full_name, title from prescribers where clinic_id = $1 order by id", [user.clinic_id]),
    one<{ ship_method: "patient" | "office" }>("select ship_method from clinics where id = $1", [user.clinic_id]),
  ]);
  return (
    <>
      <Header current="/order/new" />
      <main className="wrap">
        <div className="ph">
          <div>
            <h1>New order</h1>
            <p className="muted">Enter the patient, pick medications, then review and submit.</p>
          </div>
        </div>
        <OrderWizard meds={meds} prescribers={prescribers} clinicShips={clinic?.ship_method ?? "patient"} />
      </main>
    </>
  );
}
