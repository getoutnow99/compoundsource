import Link from "next/link";
import Header from "@/components/Header";
import { query } from "@/lib/db";
import { CATEGORY_ORDER } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function Home() {
  const cats = await query<{ category: string; n: string }>(
    "select category, count(*) as n from medications where active group by category",
  );
  const [{ meds, pharmacies }] = await query<{ meds: string; pharmacies: string }>(
    `select (select count(*) from medications where active) as meds,
            (select count(distinct pharmacy_id) from medication_prices) as pharmacies`,
  );
  const byCat = new Map(cats.map((c) => [c.category, Number(c.n)]));
  return (
    <>
      <Header />
      <main className="wrap">
        <section className="hero">
          <div>
            <div className="eyebrow">For clinics and prescribers</div>
            <h1>Every compounding pharmacy you need, in one order form.</h1>
            <p className="lead">
              Stop juggling three or four pharmacy portals. Sign up once, enter your patient, pick the medications, and we send
              each item to a partner pharmacy that has it, at pharmacy pricing.
            </p>
            <div className="facts">
              <div>
                <b>{meds}</b>
                <span>medications and supplies</span>
              </div>
              <div>
                <b>{pharmacies}</b>
                <span>partner pharmacies</span>
              </div>
              <div>
                <b>1</b>
                <span>order number to track</span>
              </div>
            </div>
            <div className="actions" style={{ justifyContent: "flex-start", marginTop: 28 }}>
              <Link className="btn primary" href="/signup">Sign up your clinic</Link>
              <Link className="btn" href="/login">Sign in</Link>
            </div>
          </div>
          <div className="card">
            <h2 style={{ fontSize: 20 }}>What you need to sign up</h2>
            <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 6 }}>
              <li>Clinic name, address and contact</li>
              <li>Each prescriber&apos;s state license, NPI and DEA numbers</li>
              <li>A copy of the prescriber license</li>
              <li>Shipping and billing preferences</li>
              <li>Signed provider agreement</li>
            </ul>
            <p className="hint">Takes about 10 minutes. We review every clinic before ordering opens.</p>
          </div>
        </section>
        <h2 className="section-title">How ordering works</h2>
        <section className="steps">
          <div className="step">
            <span className="n">1</span>
            <h3>Enter the patient</h3>
            <p>Name, date of birth and address. That&apos;s what the pharmacy needs for a patient-specific prescription.</p>
          </div>
          <div className="step">
            <span className="n">2</span>
            <h3>Pick medications</h3>
            <p>Search one combined list. Each item shows the best price across our partner pharmacies.</p>
          </div>
          <div className="step">
            <span className="n">3</span>
            <h3>Review and submit</h3>
            <p>Attach the prescription and submit. Track the whole order, even when it ships from more than one pharmacy.</p>
          </div>
        </section>
        <h2 className="section-title">What&apos;s on the list</h2>
        <div className="preview">
          {CATEGORY_ORDER.filter((c) => byCat.has(c)).map((c) => (
            <span key={c} className="chip">
              {c} <span className="muted">{byCat.get(c)}</span>
            </span>
          ))}
        </div>
      </main>
      <footer className="footer">
        <div className="wrap">CompoundSource connects clinics with licensed compounding pharmacies. Medications are dispensed only on a valid prescription.</div>
      </footer>
    </>
  );
}
