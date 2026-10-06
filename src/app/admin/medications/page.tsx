import Header from "@/components/Header";
import { requireAdmin } from "@/lib/auth";
import { loadCatalog } from "@/lib/catalog";
import { query } from "@/lib/db";
import { CATEGORY_ORDER, money } from "@/lib/format";

export default async function PriceList({ searchParams }: PageProps<"/admin/medications">) {
  await requireAdmin();
  const { q = "", cat = "All" } = (await searchParams) as { q?: string; cat?: string };
  const [meds, pharmacies] = await Promise.all([
    loadCatalog(),
    query<{ id: string; name: string }>("select id, name from pharmacies where id in (select distinct pharmacy_id from medication_prices) order by name"),
  ]);
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const list = meds.filter((m) => (cat === "All" || m.category === cat) && words.every((w) => m.name.toLowerCase().includes(w)));
  return (
    <>
      <Header current="/admin/medications" />
      <main className="wrap">
        <div className="ph"><div><h1>Price list</h1><p className="muted">Pharmacy price per unit, side by side. Clinics see the lowest price by default. To update prices, edit data/medications.json and run the setup script.</p></div></div>
        <form className="filters">
          <input name="q" type="search" defaultValue={q} placeholder="Search medications" aria-label="Search medications" />
          <select name="cat" defaultValue={cat} aria-label="Category">{["All", ...CATEGORY_ORDER].map((c) => <option key={c}>{c}</option>)}</select>
          <button className="btn">Search</button>
        </form>
        <div className="tablebox">
          <table>
            <thead><tr><th>Medication</th>{pharmacies.map((p) => <th key={p.id} className="num">{p.name.replace(/ (Pharmacy|Pharmaceuticals)$/, "")}</th>)}</tr></thead>
            <tbody>
              {list.slice(0, 300).map((m) => {
                const low = m.offers[0]?.price;
                return (
                  <tr key={m.id}>
                    <td className="med"><b>{m.name}</b><small>{m.unit} · {m.category}</small></td>
                    {pharmacies.map((p) => {
                      const o = m.offers.find((x) => x.pharmacy_id === p.id);
                      return <td key={p.id} className={`num mono ${o && o.price === low ? "lo" : ""}`}>{o ? money(o.price) : <span className="srcs">–</span>}</td>;
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="srcs">Showing {Math.min(300, list.length)} of {list.length}. Search to narrow the list.</p>
      </main>
    </>
  );
}
