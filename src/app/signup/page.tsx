import { redirect } from "next/navigation";
import Header from "@/components/Header";
import { getUser } from "@/lib/auth";
import SignupForm from "./SignupForm";

export default async function SignupPage() {
  const user = await getUser();
  if (user) redirect(user.role === "admin" ? "/admin" : "/orders");
  return (
    <>
      <Header />
      <main className="wrap">
        <div className="ph">
          <div>
            <h1>Sign up your clinic</h1>
            <p className="muted">We need the same details every partner pharmacy asks for, so you only fill them in once. We review each clinic before ordering opens.</p>
          </div>
        </div>
        <SignupForm />
      </main>
    </>
  );
}
