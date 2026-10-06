import Link from "next/link";
import { redirect } from "next/navigation";
import Header from "@/components/Header";
import { getUser } from "@/lib/auth";

export default async function PendingPage() {
  const user = await getUser();
  if (!user) redirect("/login");
  if (user.role === "admin" || user.clinic_status === "approved") redirect("/orders");
  const rejected = user.clinic_status === "rejected";
  return (
    <>
      <Header />
      <main className="wrap">
        <div className="card" style={{ margin: "48px auto" }}>
          <h1 style={{ fontSize: 24 }}>{rejected ? "Your sign-up wasn't approved" : "Thanks, your sign-up is in review"}</h1>
          <p style={{ margin: 0 }}>
            {rejected
              ? "We couldn't approve this clinic account. Reply to our email or contact us if you think this is a mistake."
              : `We're checking ${user.clinic_name}'s prescriber licenses and details. You'll get an email at ${user.email} as soon as you can start ordering.`}
          </p>
          <p className="hint">
            <Link href="/">Back to the home page</Link>
          </p>
        </div>
      </main>
    </>
  );
}
