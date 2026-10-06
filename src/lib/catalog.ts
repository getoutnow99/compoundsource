import "server-only";
import { query } from "./db";

export type CatalogMed = {
  id: number;
  name: string;
  category: string;
  unit: string;
  flags: string[];
  note: string | null;
  offers: { pharmacy_id: string; pharmacy: string; price: number }[];
};

export async function loadCatalog(): Promise<CatalogMed[]> {
  const rows = await query<{ id: number; name: string; category: string; unit: string; flags: string[]; note: string | null; offers: CatalogMed["offers"] | null }>(
    `select m.id, m.name, m.category, m.unit, m.flags, m.note,
            json_agg(json_build_object('pharmacy_id', p.id, 'pharmacy', p.name, 'price', mp.price::float) order by mp.price)
              filter (where mp.pharmacy_id is not null) as offers
       from medications m
       left join medication_prices mp on mp.medication_id = m.id
       left join pharmacies p on p.id = mp.pharmacy_id
      where m.active
      group by m.id
      order by m.category, m.name`,
  );
  return rows.map((r) => ({ ...r, offers: r.offers ?? [] }));
}
