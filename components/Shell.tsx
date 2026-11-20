"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { DataProvider } from "@/lib/data";
import { DOCS_URL } from "@/lib/links";
import { LogoMark } from "./logo";
import { AccentPicker, ThemeSwitcher } from "./ui";

const NAV = [
  { href: "/", label: "Overview", c: "#2F6FE0" },
  { href: "/settings", label: "Settings", c: "#E8590C" },
  { href: "/orgs", label: "Organizations", c: "#8E3FA8" },
  { href: "/payments", label: "Payments", c: "#2E9E4F" },
];

function AuthCard() {
  const [err, setErr] = useState("");
  const go = async (mode: "up" | "in", form: HTMLFormElement) => {
    const v = Object.fromEntries(new FormData(form)) as Record<string, string>;
    const r = mode === "up"
      ? await authClient.signUp.email({ email: v.email, password: v.password, name: v.email.split("@")[0] })
      : await authClient.signIn.email({ email: v.email, password: v.password });
    setErr(r.error?.message ?? "");
  };
  return (
    <>
      <header className="hero">
        <div className="hero-word" aria-hidden>SPLIT</div>
        <p className="eyebrow light">better-auth-nuvion example</p>
        <h1>Split every payment across your hierarchy.</h1>
        <p>One checkout, one inflow, and the plugin moves each parent&apos;s share with book transfers. Sign in to try it against the mock Nuvion.</p>
      </header>
      <form className="card pad auth" onSubmit={(e) => { e.preventDefault(); go("in", e.currentTarget); }}>
        <label className="field"><span>Email</span><input name="email" type="email" required autoComplete="email" /></label>
        <label className="field"><span>Password</span><input name="password" type="password" minLength={8} required autoComplete="current-password" /></label>
        {err && <p className="err">{err}</p>}
        <div className="actions">
          <button className="btn primary">Sign in</button>
          <button type="button" className="btn soft" onClick={(e) => go("up", e.currentTarget.form!)}>Create account</button>
        </div>
      </form>
    </>
  );
}

const PUBLIC_PATHS = ["/privacy", "/terms"]; // readable without signing in

export default function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const session = authClient.useSession();
  const links = NAV.map((n) => (
    <Link key={n.href} href={n.href} className={"nav" + (path === n.href ? " active" : "")}>
      <span className="dot" style={{ background: n.c }} />{n.label}
    </Link>
  ));
  const docsLink = <a className="nav" href={DOCS_URL} target="_blank" rel="noreferrer"><span className="dot" style={{ background: "#0E8F83" }} />Docs ↗</a>;
  const brand = <div className="brand"><span className="logo"><LogoMark size={30} /></span>Split payments</div>;
  return (
    <div className="shell">
      <aside className="side">
        {brand}
        <p className="eyebrow">Demo</p>
        {links}
        {docsLink}
        <div className="side-foot">
          {session.data && <p><small style={{ color: "var(--sand-fixed)" }}>{session.data.user.email}</small></p>}
          {session.data && <button className="btn ghost sm" onClick={() => authClient.signOut()}>Sign out</button>}
          <div style={{ marginTop: 14, display: "grid", gap: 10, justifyItems: "start" }}><ThemeSwitcher /><AccentPicker /></div>
        </div>
      </aside>
      <div className="main">
        <div className="top">{brand}<nav>{links}{docsLink}<ThemeSwitcher /><AccentPicker /></nav></div>
        {PUBLIC_PATHS.includes(path) ? children : session.isPending ? null : session.data ? <DataProvider>{children}</DataProvider> : <AuthCard />}
        <footer className="foot">
          A demo for the <a href={DOCS_URL} target="_blank" rel="noreferrer" style={{ textDecoration: "underline" }}>better-auth-nuvion</a> plugin (<a href={DOCS_URL} target="_blank" rel="noreferrer" style={{ textDecoration: "underline" }}>read the docs</a>). It runs against Nuvion&apos;s test environment with your own key, which is encrypted on the server and never sent back to your browser. No real money moves. <a href="/privacy" style={{ textDecoration: "underline" }}>Privacy</a> · <a href="/terms" style={{ textDecoration: "underline" }}>Terms</a> · <a href="https://github.com/umohpyro/better-auth-nuvion-example" target="_blank" rel="noreferrer" style={{ textDecoration: "underline" }}>Source</a>
        </footer>
      </div>
    </div>
  );
}
