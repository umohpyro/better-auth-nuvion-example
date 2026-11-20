"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Avatar, Icon } from "@/components/ui";
import { authClient } from "@/lib/auth-client";
import { useData } from "@/lib/data";
import { colorFor, money } from "@/lib/palette";

type Receipt = {
  paymentId: string;
  checkoutUrl: string;
  chargedMinor: number;
  legs: { organizationId: string; amountMinor: number }[];
  baseMinor: number;
  currency: string;
  orgId: string;
};

const STATUS: Record<string, string> = {
  settled: "ok",
  refunded: "ok",
  partial: "bad",
  failed: "bad",
  refund_partial: "bad",
};
const LABEL: Record<string, string> = {
  pending: "Waiting for the customer to pay",
  received: "Paid, splitting",
  splitting: "Splitting",
  settled: "Settled",
  partial: "Needs attention: a leg failed",
  refund_partial: "Refunding",
  refunded: "Refunded",
};
const LEG_CLASS: Record<string, string> = {
  completed: "completed",
  sent: "sent",
  failed: "failed",
  pending: "pending",
  cancelled: "cancelled",
};
const LIVE = ["pending", "received", "splitting", "refund_partial"];

export default function Payments() {
  const { state, org, call, demo, toast, refresh, depth } = useData();
  const [busy, setBusy] = useState(false);
  const [r, setR] = useState<Receipt | null>(null);
  const live = !!state?.payments.some((p) => LIVE.includes(p.status));
  useEffect(() => {
    if (!live) return;
    const t = setInterval(refresh, 4000);
    return () => clearInterval(t);
  }, [live, refresh]);
  if (!state)
    return (
      <div className="page">
        <p>Loading…</p>
      </div>
    );

  // deepest first, so the default is a merchant whose payment actually splits
  const ready = state.orgs
    .filter((o) => state.bindings.some((b) => b.organizationId === o.id))
    .sort((a, b) => depth(b.id) - depth(a.id));
  const name = (id: string) => org(id)?.name ?? id.slice(0, 6);
  const redirectDefault =
    typeof window !== "undefined" && window.location.protocol === "https:"
      ? window.location.origin + "/payments"
      : "https://example.com/done";

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const v = Object.fromEntries(new FormData(e.currentTarget)) as Record<
      string,
      string
    >;
    setBusy(true);
    const base = Math.round(Number(v.amount) * 100);
    const res = await authClient.nuvion.payments({
      organizationId: v.org,
      amountMinor: base,
      currency: v.currency.toUpperCase(),
      redirectUrl: v.redirect,
    });
    setBusy(false);
    if (res.error || !res.data)
      return toast(res.error?.message ?? "Payment failed", true);
    setR({
      ...res.data,
      baseMinor: base,
      currency: v.currency.toUpperCase(),
      orgId: v.org,
    });
    refresh();
  };
  const fee = r
    ? r.chargedMinor - r.legs.reduce((a, l) => a + l.amountMinor, 0)
    : 0;

  return (
    <>
      <header className="hero small">
        <p className="eyebrow light">Payments</p>
        <h1>Create a payment, then watch it split.</h1>
        <p>
          Create a checkout for one organization, pay it in the Nuvion sandbox,
          and this page shows each share moving up the hierarchy. Everything on
          this page is for the same job: <b>New payment</b> is how you start
          one, <b>Your payments</b> is where you follow it.
        </p>
      </header>
      <main className="page narrow">
        {!state.connection.connected && (
          <div className="notice">
            <Icon name="key" />
            <span>
              Connect your Nuvion sandbox first. Payments are real sandbox
              checkouts created with your own key.
            </span>
            <Link className="btn soft sm" href="/settings">
              Open Settings
            </Link>
          </div>
        )}
        {state.connection.connected &&
          !state.connection.webhookSecretSet &&
          !state.connection.operatorMode && (
            <div className="notice">
              <Icon name="bolt" />
              <span>
                No webhook secret saved yet. You can create checkouts, but paid
                ones will stay pending until Nuvion can reach your webhook.
              </span>
              <Link className="btn soft sm" href="/settings">
                Finish step 2
              </Link>
            </div>
          )}

        <h2 className="section-title">New payment</h2>
        {ready.length === 0 ? (
          <div className="notice">
            <Icon name="gear" />
            <span>No organization is bound to a Nuvion entity yet.</span>
            <Link className="btn soft sm" href="/orgs">
              Set up organizations
            </Link>
          </div>
        ) : (
          <form className="card pad" onSubmit={submit}>
            <label className="field">
              <span>Organization receiving the payment</span>
              <select name="org" required>
                {ready.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="cols">
              <label className="field">
                <span>Amount</span>
                <input
                  name="amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  defaultValue="10.00"
                  required
                />
              </label>
              <label className="field">
                <span>Currency</span>
                <input
                  name="currency"
                  defaultValue="GBP"
                  maxLength={3}
                  minLength={3}
                  required
                />
              </label>
            </div>
            <label className="field">
              <span>Where the customer returns after paying (https)</span>
              <input
                name="redirect"
                type="url"
                defaultValue={redirectDefault}
                required
              />
            </label>
            <button
              className="btn primary"
              disabled={busy || !state.connection.connected}
            >
              {busy ? "Creating…" : "Create checkout"}
            </button>
          </form>
        )}

        {r && (
          <section
            className="card pad receipt"
            style={{ ["--c" as string]: colorFor(r.orgId) }}
          >
            <span className="badge info">Checkout created</span>
            <div className="big">{money(r.chargedMinor, r.currency)}</div>
            <p>
              {fee > 0
                ? `The payer is charged ${money(r.chargedMinor, r.currency)}: ${money(r.baseMinor, r.currency)} plus ${money(fee, r.currency)} in fees. `
                : `The payer is charged ${money(r.chargedMinor, r.currency)}. `}
              {r.legs.length > 1
                ? `When the inflow lands it will be split into ${r.legs.length} shares:`
                : "This is a root organization, so it keeps the whole amount and nothing is split."}
            </p>
            <div className="legstrip">
              {r.legs.map((l, i) => (
                <span key={i} className="leg-chip">
                  <Avatar
                    name={name(l.organizationId)}
                    color={colorFor(l.organizationId)}
                    size={30}
                  />
                  <span>
                    <b>{name(l.organizationId)}</b>{" "}
                    {money(l.amountMinor, r.currency)}
                    {i === 0 ? <small> · keeps</small> : null}
                  </span>
                </span>
              ))}
            </div>
            <ol className="steps-text left">
              <li>
                Open the checkout and pay with the sandbox bank (any bank works;
                no real money moves).
              </li>
              <li>
                Nuvion sends the <code>inflows.completed</code> webhook to your
                URL, and the plugin moves each share with a book transfer
                between your accounts.
              </li>
              <li>
                Watch the shares appear under <b>Your payments</b> below. Nuvion
                then confirms each transfer with an{" "}
                <code>outflows.completed</code> webhook. This page refreshes by
                itself.
              </li>
            </ol>
            <div className="actions" style={{ justifyContent: "center" }}>
              <a
                className="btn primary"
                href={r.checkoutUrl}
                target="_blank"
                rel="noreferrer"
              >
                Open checkout
              </a>
            </div>
          </section>
        )}

        <h2 className="section-title">Your payments</h2>
        {state.payments.length === 0 && (
          <p className="hint">Nothing yet. Create a payment above.</p>
        )}
        {state.payments.map((p) => {
          return (
            <article
              key={p.id}
              className="card pay-card"
              style={{ ["--c" as string]: colorFor(p.organizationId) }}
            >
              <div className="card-band">
                <span>{name(p.organizationId)}</span>
                <span
                  className={"badge " + (STATUS[p.status] ?? "info")}
                  style={{
                    background: "rgba(255,255,255,.92)",
                    color: "var(--band)",
                  }}
                >
                  {LABEL[p.status] ?? p.status}
                </span>
              </div>
              <div className="body">
                <div
                  className="big"
                  style={{ fontSize: "2rem", textAlign: "left" }}
                >
                  {money(p.chargedMinor, p.currency)}
                </div>
                <small className="mono">{p.reference}</small>
                {p.legs.length === 0 ? (
                  <p className="hint" style={{ marginTop: 12 }}>
                    {p.status === "pending"
                      ? "No shares yet. They are created when Nuvion sends the inflows.completed webhook after the checkout is paid."
                      : "No shares: this payment is not split."}
                  </p>
                ) : (
                  <ol className="steps" style={{ marginTop: 14 }}>
                    {p.legs.map((l) => {
                      return (
                        <li key={l.id} className={LEG_CLASS[l.state]}>
                          <details>
                            <summary>
                              <Avatar
                                name={name(l.fromOrganizationId)}
                                color={colorFor(l.fromOrganizationId)}
                                size={26}
                              />
                              <Icon name="arrow" size={14} />
                              <Avatar
                                name={name(l.toOrganizationId)}
                                color={colorFor(l.toOrganizationId)}
                                size={26}
                              />
                              <b className="mono">
                                {money(l.amountMinor, p.currency)}
                              </b>
                              <span className="chip">
                                {l.kind === "reversal" ? "reversal · " : ""}
                                {l.state}
                              </span>
                              <em>attempt {l.attempt}</em>
                            </summary>
                            <p className="hint" style={{ marginTop: 8 }}>
                              {name(l.fromOrganizationId)} →{" "}
                              {name(l.toOrganizationId)} · reference{" "}
                              <code>
                                {l.id}-a{l.attempt}
                              </code>
                            </p>
                            {l.error && <p className="err">{l.error}</p>}
                          </details>
                        </li>
                      );
                    })}
                  </ol>
                )}
                <div className="row-actions">
                  {state.localSimulate && p.status === "pending" && (
                    <button
                      className="btn soft sm"
                      onClick={() => demo("simulate-inflow", p.id)}
                    >
                      <Icon name="bolt" size={16} />
                      Simulate inflow (local only)
                    </button>
                  )}
                  {state.localSimulate &&
                    p.legs.some((l) => l.state === "sent") && (
                      <button
                        className="btn soft sm"
                        onClick={() => demo("simulate-settle", p.id)}
                      >
                        <Icon name="check" size={16} />
                        Simulate transfers completed (local only)
                      </button>
                    )}
                  {["partial", "splitting"].includes(p.status) && (
                    <button
                      className="btn primary sm"
                      onClick={() =>
                        call(
                          authClient.nuvion.payments.retry({ paymentId: p.id }),
                        )
                      }
                    >
                      <Icon name="repeat" size={16} />
                      Retry failed legs
                    </button>
                  )}
                  {!["pending", "refunded", "refund_partial"].includes(
                    p.status,
                  ) && (
                    <button
                      className="btn soft sm"
                      onClick={() => {
                        if (
                          confirm(
                            "Refund this payment? Shares already moved are reversed back to the merchant. The customer is not paid back by this demo.",
                          )
                        )
                          call(
                            authClient.nuvion.payments.refund({
                              paymentId: p.id,
                            }),
                          );
                      }}
                    >
                      <Icon name="x" size={16} />
                      Refund
                    </button>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </main>
    </>
  );
}
