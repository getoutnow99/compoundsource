"use client";
import { useActionState, useMemo, useRef, useState } from "react";
import { submitOrder, type OrderState } from "@/app/actions/orders";
import type { CatalogMed } from "@/lib/catalog";
import { CATEGORY_ORDER, US_STATES, money } from "@/lib/format";

type Prescriber = { id: number; full_name: string; title: string };
type Line = { qty: number; pharmacy: string | null };

const PATIENT_FIELDS = ["patient_first", "patient_last", "patient_dob", "patient_street", "patient_city", "patient_state", "patient_zip"] as const;
const FIELD_MSG: Record<string, string> = {
  patient_first: "Enter a first name",
  patient_last: "Enter a last name",
  patient_dob: "Enter a date of birth",
  patient_street: "Enter a street address",
  patient_city: "Enter a city",
  patient_state: "Pick a state",
  patient_zip: "Use 5 digits, e.g. 33511",
};

export default function OrderWizard({ meds, prescribers, clinicShips }: { meds: CatalogMed[]; prescribers: Prescriber[]; clinicShips: "patient" | "office" }) {
  const [state, action, pending] = useActionState<OrderState, FormData>(submitOrder, {});
  const [step, setStep] = useState(1);
  const [pt, setPt] = useState<Record<string, string>>({ prescriber_id: prescribers.length === 1 ? String(prescribers[0].id) : "" });
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [cart, setCart] = useState<Record<number, Line>>({});
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("All");
  const [limit, setLimit] = useState(60);
  const qtyRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const byId = useMemo(() => new Map(meds.map((m) => [m.id, m])), [meds]);
  const serverErrs = state.errors || {};
  const allErrs = { ...serverErrs, ...errs };

  const set = (k: string, v: string) => setPt((p) => ({ ...p, [k]: v }));
  const checkPatient = () => {
    const e: Record<string, string> = {};
    for (const k of PATIENT_FIELDS) if (!String(pt[k] || "").trim()) e[k] = FIELD_MSG[k];
    if (pt.patient_zip && !/^\d{5}(-\d{4})?$/.test(pt.patient_zip)) e.patient_zip = FIELD_MSG.patient_zip;
    if (pt.patient_dob && new Date(pt.patient_dob) > new Date()) e.patient_dob = "Date of birth can't be in the future";
    if (!pt.prescriber_id) e.prescriber_id = "Pick the prescriber";
    setErrs(e);
    return !Object.keys(e).length;
  };
  const go = (n: number) => {
    if (n > 1 && !checkPatient()) return setStep(1);
    setStep(n);
    window.scrollTo(0, 0);
  };

  const list = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    return meds
      .filter((m) => (cat === "All" || m.category === cat) && words.every((w) => `${m.name} ${m.category}`.toLowerCase().includes(w)))
      .sort((a, b) => CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category) || a.name.localeCompare(b.name));
  }, [meds, q, cat]);

  const lines = Object.entries(cart).map(([id, l]) => ({ med: byId.get(Number(id))!, ...l }));
  const priceOf = (m: CatalogMed, ph: string | null) => m.offers.find((o) => o.pharmacy_id === ph)?.price ?? null;
  const total = lines.reduce((s, l) => s + (priceOf(l.med, l.pharmacy) ?? 0) * l.qty, 0);
  const quotes = lines.filter((l) => priceOf(l.med, l.pharmacy) == null).length;
  const pharmacyCount = new Set(lines.map((l) => l.pharmacy ?? "quote")).size;
  const hasControlled = lines.some((l) => l.med.flags.includes("controlled"));

  const field = (k: string, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label htmlFor={k}>
      {label}
      <input id={k} name={k} value={pt[k] || ""} onChange={(e) => set(k, e.target.value)} aria-invalid={allErrs[k] ? true : undefined} {...props} />
      {allErrs[k] && <span className="err">{allErrs[k]}</span>}
    </label>
  );
  const fmtDob = (d?: string) => (d ? `${d.slice(5, 7)}/${d.slice(8, 10)}/${d.slice(0, 4)}` : "");
  const prescriber = prescribers.find((p) => String(p.id) === pt.prescriber_id);

  return (
    <form action={action}>
      <nav className="wiz" aria-label="Order steps">
        {[[1, "1 · Patient"], [2, "2 · Medications"], [3, "3 · Review"]].map(([n, l]) => (
          <button type="button" key={n} onClick={() => go(n as number)} aria-current={step === n ? "step" : undefined} className={step > (n as number) ? "done" : ""}>
            {l}
          </button>
        ))}
      </nav>
      {state.message && <p className="notice bad">{state.message} {Object.values(serverErrs).join(" ")}</p>}

      {step > 1 && (
        <div className="pt-strip">
          <span>Patient</span>
          <b>{pt.patient_first} {pt.patient_last}</b>
          <span className="muted">DOB {fmtDob(pt.patient_dob)} · {pt.patient_city}, {pt.patient_state}</span>
          <button type="button" className="btn small" style={{ marginLeft: "auto" }} onClick={() => go(1)}>Edit</button>
        </div>
      )}

      {/* Step 1: every patient input stays mounted so it is submitted with the form. */}
      <div className="card" hidden={step !== 1}>
        <h2 style={{ fontSize: 18 }}>Patient information</h2>
        <div className="grid2">
          {field("patient_first", "First name", { autoComplete: "off" })}
          {field("patient_last", "Last name", { autoComplete: "off" })}
          {field("patient_dob", "Date of birth", { type: "date", max: new Date().toISOString().slice(0, 10) })}
          {field("patient_phone", "Phone (optional)", { type: "tel" })}
        </div>
        {field("patient_street", "Street address")}
        <div className="grid3">
          {field("patient_city", "City")}
          <label htmlFor="patient_state">
            State
            <select id="patient_state" name="patient_state" value={pt.patient_state || ""} onChange={(e) => set("patient_state", e.target.value)} aria-invalid={allErrs.patient_state ? true : undefined}>
              <option value="" disabled>Select</option>
              {US_STATES.map((s) => <option key={s}>{s}</option>)}
            </select>
            {allErrs.patient_state && <span className="err">{allErrs.patient_state}</span>}
          </label>
          {field("patient_zip", "ZIP", { inputMode: "numeric", maxLength: 10 })}
        </div>
        {field("patient_allergies", "Allergies (optional)")}
        <label htmlFor="prescriber_id">
          Prescriber
          <select id="prescriber_id" name="prescriber_id" value={pt.prescriber_id || ""} onChange={(e) => set("prescriber_id", e.target.value)} aria-invalid={allErrs.prescriber_id ? true : undefined}>
            <option value="" disabled>Select the prescriber</option>
            {prescribers.map((p) => <option key={p.id} value={p.id}>{p.full_name}, {p.title}</option>)}
          </select>
          {allErrs.prescriber_id && <span className="err">{allErrs.prescriber_id}</span>}
        </label>
        <div className="actions">
          <button type="button" className="btn primary" onClick={() => go(2)}>Next: pick medications</button>
        </div>
      </div>

      {step === 2 && (
        <div className="shop">
          <section style={{ minWidth: 0 }}>
            <div className="filters">
              <input type="search" placeholder={`Search ${meds.length} items, e.g. testosterone 10 mL`} value={q} onChange={(e) => { setQ(e.target.value); setLimit(60); }} aria-label="Search medications" />
              <select value={cat} onChange={(e) => { setCat(e.target.value); setLimit(60); }} aria-label="Category">
                {["All", ...CATEGORY_ORDER].map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="tablebox">
              <table>
                <thead><tr><th>Medication</th><th className="hide-sm">Category</th><th className="num">Price</th><th className="num">Qty</th></tr></thead>
                <tbody>
                  {list.slice(0, limit).map((m) => (
                    <tr key={m.id}>
                      <td className="med">
                        <b>{m.name}</b>
                        <small>{m.unit === "each" ? "Priced each" : m.unit[0].toUpperCase() + m.unit.slice(1)}{m.note ? ` · ${m.note}` : ""}</small>
                        {m.flags.length > 0 && (
                          <div className="flags">
                            {m.flags.includes("controlled") && <span className="chip ctl" title="Needs a prescriber DEA number">Controlled</span>}
                            {m.flags.includes("restricted") && <span className="chip warn" title="FDA has restricted compounding of this drug. Confirm the pharmacy can still fill it.">Check FDA status</span>}
                          </div>
                        )}
                      </td>
                      <td className="hide-sm"><span className="chip cat">{m.category}</span></td>
                      <td className="num mono">
                        {m.offers[0] ? money(m.offers[0].price) : "Quote"}
                        {m.offers.length > 1 && <div className="srcs">best of {m.offers.length}</div>}
                      </td>
                      <td>
                        <div className="qty">
                          <input type="number" min={1} max={999} placeholder="1" defaultValue={cart[m.id]?.qty} ref={(el) => { qtyRefs.current[m.id] = el; }} aria-label={`Quantity for ${m.name}`} />
                          <button type="button" className="btn small" onClick={() => {
                            const qty = Math.max(1, Math.min(999, parseInt(qtyRefs.current[m.id]?.value || "1", 10) || 1));
                            setCart((c) => ({ ...c, [m.id]: { qty, pharmacy: c[m.id]?.pharmacy ?? m.offers[0]?.pharmacy_id ?? null } }));
                          }}>{cart[m.id] ? "Update" : "Add"}</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!list.length && <tr><td colSpan={4} className="empty">No medications match &quot;{q}&quot;. Try a shorter search or another category.</td></tr>}
                </tbody>
              </table>
            </div>
            <p className="srcs" style={{ display: "flex", gap: 12, alignItems: "center" }}>
              Showing {Math.min(limit, list.length)} of {list.length}
              {list.length > limit && <button type="button" className="btn small" onClick={() => setLimit(limit + 100)}>Show more</button>}
            </p>
          </section>
          <aside className="cart" aria-label="Medications for this patient">
            <h2>For {pt.patient_first}</h2>
            {lines.length ? lines.map((l) => (
              <div className="cart-line" key={l.med.id}>
                <span>{l.med.name} <span className="muted">× {l.qty}</span></span>
                <span className="mono">{money(priceOf(l.med, l.pharmacy) == null ? null : priceOf(l.med, l.pharmacy)! * l.qty)}</span>
                {l.med.offers.length > 1 ? (
                  <select className="phsel" value={l.pharmacy ?? ""} onChange={(e) => setCart((c) => ({ ...c, [l.med.id]: { ...c[l.med.id], pharmacy: e.target.value } }))} aria-label={`Pharmacy for ${l.med.name}`}>
                    {l.med.offers.map((o) => <option key={o.pharmacy_id} value={o.pharmacy_id}>{o.pharmacy} · {money(o.price)}</option>)}
                  </select>
                ) : <span className="srcs">{l.med.offers[0]?.pharmacy ?? "We'll get you a quote"}</span>}
                <button type="button" className="x" onClick={() => setCart((c) => { const n = { ...c }; delete n[l.med.id]; return n; })}>Remove</button>
              </div>
            )) : <p className="empty">Nothing added yet. Enter a quantity and press Add.</p>}
            {lines.length > 0 && (
              <>
                <div className="total"><span>Total{quotes > 0 && <span className="srcs"> + {quotes} quote{quotes > 1 ? "s" : ""}</span>}</span><span className="mono">{money(total)}</span></div>
                <button type="button" className="btn primary" onClick={() => go(3)}>Next: review order</button>
              </>
            )}
          </aside>
        </div>
      )}

      <input type="hidden" name="items" value={JSON.stringify(lines.map((l) => ({ id: l.med.id, qty: l.qty, pharmacy: l.pharmacy })))} />

      <div className="review" hidden={step !== 3}>
        <section className="card">
          <h2 style={{ fontSize: 18 }}>Patient</h2>
          <dl className="kv">
            <dt>Name</dt><dd>{pt.patient_first} {pt.patient_last}</dd>
            <dt>Date of birth</dt><dd>{fmtDob(pt.patient_dob)}</dd>
            <dt>Address</dt><dd>{pt.patient_street}<br />{pt.patient_city}, {pt.patient_state} {pt.patient_zip}</dd>
            {pt.patient_phone && <><dt>Phone</dt><dd>{pt.patient_phone}</dd></>}
            <dt>Allergies</dt><dd>{pt.patient_allergies || "None listed"}</dd>
            <dt>Prescriber</dt><dd>{prescriber ? `${prescriber.full_name}, ${prescriber.title}` : ""}</dd>
          </dl>
          <label htmlFor="rx_files">
            Prescription
            <input id="rx_files" name="rx_files" type="file" multiple accept=".pdf,image/*" />
            <span className="hint">PDF or photo of the signed prescription, up to 10 MB.</span>
            {allErrs.rx_files && <span className="err">{allErrs.rx_files}</span>}
          </label>
          <label htmlFor="ship_to">
            Ship to
            <select id="ship_to" name="ship_to" defaultValue={clinicShips === "office" ? "clinic" : "patient"}>
              <option value="patient">Patient&apos;s address above</option>
              <option value="clinic">Clinic address on file</option>
            </select>
          </label>
          <label htmlFor="notes">
            Notes for the pharmacy (optional)
            <textarea id="notes" name="notes" rows={2} maxLength={2000} />
          </label>
        </section>
        <section className="cart" style={{ position: "static" }}>
          <h2>Medications</h2>
          {lines.map((l) => (
            <div className="cart-line" key={l.med.id}>
              <span>{l.med.name} <span className="muted">× {l.qty}</span></span>
              <span className="mono">{money(priceOf(l.med, l.pharmacy) == null ? null : priceOf(l.med, l.pharmacy)! * l.qty)}</span>
              <span className="srcs">{l.med.offers.find((o) => o.pharmacy_id === l.pharmacy)?.pharmacy ?? "We'll get you a quote"}</span>
            </div>
          ))}
          {!lines.length && <p className="empty">No medications yet.</p>}
          <div className="total"><span>Total{quotes > 0 && <span className="srcs"> + {quotes} quote{quotes > 1 ? "s" : ""}</span>}</span><span className="mono">{money(total)}</span></div>
          {lines.length > 0 && <div className="route">Fills from <b>{pharmacyCount}</b> pharmac{pharmacyCount > 1 ? "ies" : "y"}. You get one order number to track it all.</div>}
          {hasControlled && <p className="srcs" style={{ margin: 0 }}>This order has controlled items, so the prescriber needs a DEA number on file.</p>}
          <div className="actions">
            <button type="button" className="btn" onClick={() => go(2)}>Back</button>
            <button type="submit" className="btn primary" disabled={pending || !lines.length}>{pending ? "Submitting…" : "Submit order"}</button>
          </div>
        </section>
      </div>
    </form>
  );
}
