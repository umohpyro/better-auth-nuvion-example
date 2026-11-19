"use client";
import Link from "next/link";
import { Avatar, Icon } from "@/components/ui";
import { useData, type Org } from "@/lib/data";
import { DOCS_URL } from "@/lib/links";
import { colorFor, money } from "@/lib/palette";

export default function Overview() {
  const { state, depth } = useData();
  if (!state) return <div className="page"><p>Loading…</p></div>;
  const { orgs, bindings, rules, payments, connection } = state;
  const bound = new Set(bindings.map((b) => b.organizationId));
  const children = orgs.filter((o) => o.parentOrganizationId);
  const ruled = new Set(rules.map((r) => r.organizationId));
  const settled = payments.filter((p) => p.status === "settled").reduce((a, p) => a + p.chargedMinor, 0);
  const ok = connection.operatorMode || (connection.connected && connection.webhookSecretSet);

  const steps: { t: string; why: string; done: boolean; href: string; cta: string }[] = [
    { t: "Connect your Nuvion sandbox", why: "Paste your own sandbox API key and pick the entity and account that receive money.", done: connection.connected, href: "/settings", cta: "Connect" },
    { t: "Create your webhook", why: "Nuvion tells this app a payment arrived by webhook. One click creates it in your sandbox. Optionally watch deliveries in Hookbox.", done: connection.operatorMode || connection.webhookSecretSet, href: "/settings", cta: "Set up webhook" },
    { t: "Create your organizations", why: "One is enough: a lone merchant keeps everything. Add a platform above it to take a fee, or a reseller between them for three levels (the maximum).", done: orgs.length >= 1, href: "/orgs", cta: "Build hierarchy" },
    { t: "Give each organization its own Nuvion account", why: "Tells the plugin which account each organization uses. Each one needs a different account so shares can move between them.", done: orgs.length > 0 && orgs.every((o) => bound.has(o.id)), href: "/orgs", cta: "Assign accounts" },
    { t: "Set fee rules", why: "A fee rule decides what each parent takes from its child. A lone organization has no parent, so it has nothing to set. The plugin creates the transfer counterparties itself.", done: orgs.length > 0 && children.every((o) => ruled.has(o.id)), href: "/orgs", cta: "Set fee rules" },
    { t: "Make a payment and watch it split", why: "Create a checkout, pay it in the sandbox, and see every share move.", done: payments.length > 0, href: "/payments", cta: "New payment" },
  ];
  const next = steps.find((s) => !s.done);

  const roots = orgs.filter((o) => !o.parentOrganizationId);
  const row = (o: Org): React.ReactNode => {
    const r = rules.find((x) => x.organizationId === o.id);
    return (
      <div key={o.id} style={{ display: "grid", gap: 10 }}>
        <div className="tree-row" style={{ marginLeft: (depth(o.id) - 1) * 28 }}>
          <Avatar name={o.name} color={colorFor(o.id)} size={38} />
          <div className="grow"><b>{o.name}</b><br /><small>Level {depth(o.id)}{bound.has(o.id) ? " · bound" : " · not bound"}</small></div>
          {r && <span className="chip">takes {r.bps / 100}%{r.flatMinor ? ` + ${money(r.flatMinor)}` : ""} · {r.bearer} pays</span>}
        </div>
        {orgs.filter((c) => c.parentOrganizationId === o.id).map(row)}
      </div>
    );
  };

  return (
    <>
      <header className="hero">
        <div className="hero-word" aria-hidden>SPLIT</div>
        <p className="eyebrow light">Overview</p>
        <h1>One payment, a share for every parent.</h1>
        <p>A customer pays a merchant once through Nuvion hosted checkout. The <code>better-auth-nuvion</code> plugin then moves each parent&apos;s share with book transfers, keeps a ledger, and can retry or refund. This app lets you try it with your own Nuvion sandbox.</p>
        <div className="hero-actions">
          {next ? <Link className="btn primary" href={next.href}>Next step: {next.cta}</Link> : <Link className="btn primary" href="/payments">New payment</Link>}
          <a className="btn ghost" href={DOCS_URL} target="_blank" rel="noreferrer">Read the docs</a>
        </div>
      </header>
      <div className="stats">
        <div className="card stat"><b>{orgs.length}</b><span>organizations</span></div>
        <div className="card stat"><b>{bindings.length}</b><span>bound to Nuvion</span></div>
        <div className="card stat"><b>{payments.length}</b><span>payments</span></div>
        <div className="card stat"><b>{money(settled)}</b><span>settled</span></div>
      </div>
      <main className="page">
        <section className="card pad">
          <h3>Get started</h3>
          <p className="hint">Follow these in order. Each step opens the page where you do it.{ok ? "" : " Steps 1 and 2 are one-time."}</p>
          <ol className="guide">
            {steps.map((s, i) => (
              <li key={s.t} className={s.done ? "done" : s === next ? "next" : ""}>
                <span className={"tick" + (s.done ? " on" : "")}>{s.done ? <Icon name="check" size={14} /> : i + 1}</span>
                <div className="grow"><b>{s.t}</b><p>{s.why}</p></div>
                {!s.done && <Link className={"btn sm " + (s === next ? "primary" : "soft")} href={s.href}>{s.cta}</Link>}
              </li>
            ))}
          </ol>
        </section>

        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
          <section className="card pad">
            <h3>Your hierarchy</h3>
            {orgs.length === 0 ? <p className="hint">No organizations yet. Step 3 creates them.</p> : <div className="tree">{roots.map(row)}</div>}
            <p className="hint" style={{ marginTop: 12 }}>Depth is capped at 3 levels and cycles are rejected.</p>
          </section>
          <section className="card pad">
            <h3>Words used in this app</h3>
            <dl className="diff" style={{ ["--c" as string]: "var(--accent-text)" }}>
              <dt>Organization</dt><dd>A business that can take payments. It can have one parent.</dd>
              <dt>Fee rule</dt><dd>What a parent takes from its child&apos;s payments: basis points (100 = 1%), a flat amount, a minimum, a cap, and who pays it.</dd>
              <dt>Leg</dt><dd>One book transfer that moves one share to a parent.</dd>
              <dt>Partial</dt><dd>A payment where at least one leg failed. Retry the failed legs.</dd>
              <dt>Refund</dt><dd>Cancels unsent legs and sends reversal legs back to the merchant.</dd>
              <dt>Counterparty</dt><dd>The record Nuvion needs before it can send a book transfer to another account. The plugin creates it the first time it is needed.</dd>
            </dl>
          </section>
        </div>

        <section className="how">
          <h3>What happens on a payment</h3>
          <ol>
            <li>The merchant creates a funding session with <code>authClient.nuvion.payments</code>. Nuvion returns a hosted checkout URL.</li>
            <li>The customer pays. Nuvion posts a signed <code>inflows.completed</code> webhook to your webhook URL.</li>
            <li>The plugin verifies the signature, matches the payment, and creates one book transfer per share.</li>
            <li><code>outflows.completed</code> events settle each leg. A rejected leg leaves the payment partial until you retry it.</li>
          </ol>
        </section>
      </main>
    </>
  );
}
