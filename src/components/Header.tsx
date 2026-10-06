import Link from "next/link";
import { getUser } from "@/lib/auth";
import { logout } from "@/app/actions/auth";

type Tab = { href: string; label: string };

export default async function Header({ current }: { current?: string }) {
  const user = await getUser();
  let tabs: Tab[] = [];
  if (user?.role === "clinic" && user.clinic_status === "approved")
    tabs = [
      { href: "/order/new", label: "New order" },
      { href: "/orders", label: "My orders" },
      { href: "/account", label: "Account" },
    ];
  if (user?.role === "admin")
    tabs = [
      { href: "/admin", label: "Order queue" },
      { href: "/admin/clinics", label: "Clinics" },
      { href: "/admin/medications", label: "Price list" },
    ];
  return (
    <header className="top">
      <div className="wrap">
        <Link href="/" className="brand" style={{ textDecoration: "none", color: "inherit" }}>
          <span className="mark">CS</span>
          <span className="hide-sm">CompoundSource</span>
        </Link>
        <nav className="tabs">
          {tabs.map((t) => (
            <Link key={t.href} href={t.href} className="tab" aria-current={current === t.href ? "page" : undefined} style={{ textDecoration: "none" }}>
              {t.label}
            </Link>
          ))}
        </nav>
        <div className="who">
          {user ? (
            <>
              <span className="name muted">{user.role === "admin" ? "Admin" : user.clinic_name}</span>
              <form action={logout}>
                <button className="btn small">Sign out</button>
              </form>
            </>
          ) : (
            <>
              <Link className="btn small" href="/login">Sign in</Link>
              <Link className="btn small primary" href="/signup">Sign up</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
