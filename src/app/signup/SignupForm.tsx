"use client";
import { createContext, useActionState, useContext, useState } from "react";
import { signup, type SignupState } from "@/app/actions/signup";
import { AGREEMENT } from "@/lib/agreement";
import { US_STATES } from "@/lib/format";

const TITLES = ["MD", "DO", "NP", "APRN", "PA-C", "Other"];

const Ctx = createContext<{ v: Record<string, string>; e: Record<string, string> }>({ v: {}, e: {} });

function F({ name, label, type = "text", hint, ...rest }: { name: string; label: string; type?: string; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  const { v, e } = useContext(Ctx);
  return (
  <label htmlFor={name}>
    {label}
    <input id={name} name={name} type={type} defaultValue={v[name]} aria-invalid={e[name] ? true : undefined} {...rest} />
    {hint && !e[name] && <span className="hint">{hint}</span>}
    {e[name] && <span className="err">{e[name]}</span>}
  </label>
  );
}
function S({ name, label, options, placeholder = "Select" }: { name: string; label: string; options: string[]; placeholder?: string }) {
  const { v, e } = useContext(Ctx);
  return (
  <label htmlFor={name}>
    {label}
    <select id={name} name={name} defaultValue={v[name] || ""} aria-invalid={e[name] ? true : undefined}>
      <option value="" disabled>{placeholder}</option>
      {options.map((o) => <option key={o}>{o}</option>)}
    </select>
    {e[name] && <span className="err">{e[name]}</span>}
  </label>
  );
}
function Radio({ name, options, value, onChange }: { name: string; options: [string, string][]; value?: string; onChange?: (v: string) => void }) {
  const { v, e } = useContext(Ctx);
  return (
  <div>
    <div className="radio-row" role="radiogroup">
      {options.map(([val, lab]) => (
        <label key={val}>
          <input type="radio" name={name} value={val} defaultChecked={(value ?? v[name]) === val} onChange={() => onChange?.(val)} /> {lab}
        </label>
      ))}
    </div>
    {e[name] && <span className="err">{e[name]}</span>}
  </div>
  );
}



export default function SignupForm() {
  const [state, action, pending] = useActionState<SignupState, FormData>(signup, {});
  const v = state.values || {};
  const e = state.errors || {};
  const [count, setCount] = useState(Math.max(1, Number(v.prescriber_count || 1)));
  const [ship, setShip] = useState(v.ship_method || "patient");

  return (
    <Ctx.Provider value={{ v, e }}>
    <form action={action} className="form-col" noValidate>
      {state.message && <p className="notice bad">{state.message}</p>}

      <fieldset>
        <legend>Clinic</legend>
        <F name="name" label="Clinic or practice name" autoComplete="organization" />
        <F name="street" label="Street address" autoComplete="street-address" />
        <div className="grid3">
          <F name="city" label="City" />
          <S name="state" label="State" options={US_STATES} />
          <F name="zip" label="ZIP" inputMode="numeric" />
        </div>
        <div className="grid2">
          <F name="phone" label="Phone" type="tel" />
          <F name="email" label="Clinic email" type="email" />
          <F name="fax" label="Fax (optional)" type="tel" />
          <F name="website" label="Website (optional)" />
          <F name="office_hours" label="Office hours (optional)" placeholder="Mon-Fri 9-5, lunch 12-1" />
          <F name="emr_system" label="EMR system (optional)" placeholder="e.g. DrChrono" />
        </div>
      </fieldset>

      <fieldset>
        <legend>Prescribers authorized to order</legend>
        <p className="hint">List everyone who will write prescriptions under this account. Only these prescribers can order.</p>
        <input type="hidden" name="prescriber_count" value={count} />
        {Array.from({ length: count }, (_, i) => (
          <div key={i} style={{ display: "grid", gap: 12, paddingTop: i ? 12 : 0, borderTop: i ? "1px dashed var(--line)" : undefined }}>
            <div className="grid2">
              <F name={`p${i}_full_name`} label={`Prescriber ${i + 1} full name`} />
              <S name={`p${i}_title`} label="Title" options={TITLES} />
              <F name={`p${i}_state_license`} label="State license number" />
              <S name={`p${i}_license_state`} label="License state" options={US_STATES} />
              <F name={`p${i}_npi`} label="NPI number" inputMode="numeric" />
              <F name={`p${i}_dea`} label="DEA number" hint="Required for controlled medications like testosterone" />
            </div>
          </div>
        ))}
        <div className="actions" style={{ justifyContent: "flex-start" }}>
          {count < 8 && <button type="button" className="btn small" onClick={() => setCount(count + 1)}>Add another prescriber</button>}
          {count > 1 && <button type="button" className="btn small" onClick={() => setCount(count - 1)}>Remove last prescriber</button>}
        </div>
        <label htmlFor="license_files">
          Copy of each prescriber&apos;s license
          <input id="license_files" name="license_files" type="file" multiple accept=".pdf,image/*" aria-invalid={e.license_files ? true : undefined} />
          <span className="hint">The license printout from the state board website. PDF, JPG or PNG, up to 8 MB each.</span>
          {e.license_files && <span className="err">{e.license_files}</span>}
        </label>
      </fieldset>

      <fieldset>
        <legend>Order processing</legend>
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)" }}>Ship orders to</span>
        <Radio name="ship_method" options={[["patient", "The patient (address given on each order)"], ["office", "Our office"]]} value={ship} onChange={setShip} />
        {ship === "office" && (
          <>
            <F name="ship_street" label="Office ship-to street" />
            <div className="grid3">
              <F name="ship_city" label="City" />
              <S name="ship_state" label="State" options={US_STATES} />
              <F name="ship_zip" label="ZIP" inputMode="numeric" />
            </div>
          </>
        )}
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)" }}>Day orders should arrive</span>
        <Radio name="delivery_day" options={[["Tue", "Tue"], ["Wed", "Wed"], ["Thu", "Thu"], ["Fri", "Fri"]]} />
        <div className="grid2">
          <F name="contact_name" label="Practice contact" />
          <F name="contact_phone" label="Contact phone" type="tel" />
          <F name="contact_email" label="Contact email" type="email" />
        </div>
      </fieldset>

      <fieldset>
        <legend>Payment</legend>
        <Radio name="payment_method" options={[["card", "Credit card"], ["invoice", "Invoice"]]} />
        <p className="hint">For your security we never take card numbers on this form. Once you&apos;re approved we&apos;ll send a secure link to add a card.</p>
        <F name="billing_name" label="Cardholder or billing name" />
        <F name="billing_street" label="Billing street" />
        <div className="grid3">
          <F name="billing_city" label="City" />
          <S name="billing_state" label="State" options={US_STATES} />
          <F name="billing_zip" label="ZIP" inputMode="numeric" />
        </div>
        <F name="billing_email" label="Billing email for receipts and statements" type="email" />
      </fieldset>

      <fieldset>
        <legend>Provider agreement</legend>
        <div className="agreement">
          {AGREEMENT.map((p, i) => <p key={i} style={{ margin: "0 0 8px" }}>{p}</p>)}
        </div>
        <div className="grid2">
          <F name="agreement_name" label="Authorized signature (type your full name)" />
          <F name="agreement_title" label="Title (optional)" />
        </div>
        <label className="check" htmlFor="agree">
          <input id="agree" name="agree" type="checkbox" defaultChecked={v.agree === "on"} />
          I have read and agree to the provider agreement, and the information on this form is accurate.
        </label>
        {e.agree && <span className="err">{e.agree}</span>}
      </fieldset>

      <fieldset>
        <legend>Your login</legend>
        <div className="grid2">
          <F name="login_name" label="Your name" autoComplete="name" />
          <F name="login_email" label="Login email" type="email" autoComplete="username" />
          <F name="password" label="Password" type="password" autoComplete="new-password" hint="At least 12 characters" />
          <F name="password2" label="Confirm password" type="password" autoComplete="new-password" />
        </div>
      </fieldset>

      {state.message && <p className="notice bad">{state.message} If you attached license files, attach them again.</p>}
      <div className="actions">
        <button className="btn primary" type="submit" disabled={pending}>{pending ? "Submitting…" : "Submit sign-up"}</button>
      </div>
    </form>
    </Ctx.Provider>
  );
}
