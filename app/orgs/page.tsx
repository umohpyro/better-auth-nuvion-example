"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Avatar, Icon } from "@/components/ui";
import { authClient } from "@/lib/auth-client";
import { useData, type Org } from "@/lib/data";
import { colorFor, money } from "@/lib/palette";

type Account = {
  id: string;
  name: string;
  currency: string;
  available: number | null;
};
const val = (e: React.FormEvent<HTMLFormElement>) => {
  e.preventDefault();
  return Object.fromEntries(new FormData(e.currentTarget)) as Record<
    string,
    string
  >;
};
const settings = async (body: unknown) => {
  const r = await fetch("/api/settings", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error ?? "Something went wrong");
  return j;
};

function OrgCard({ o, accounts }: { o: Org; accounts: Account[] }) {
  const { state, org, depth, call } = useData();
  const s = state!;
  const c = colorFor(o.id);
  const parent = o.parentOrganizationId
    ? org(o.parentOrganizationId)
    : undefined;
  const bind = s.bindings.find((b) => b.organizationId === o.id);
  const rule = s.rules.find((r) => r.organizationId === o.id);
  const conn = s.connection;
  const [acc, setAcc] = useState(bind?.accountId ?? "");
  const usedBy = (id: string) => {
    const b = s.bindings.find(
      (x) => x.accountId === id && x.organizationId !== o.id,
    );
    return b ? org(b.organizationId)?.name : undefined;
  };
  const accName = (id: string) => accounts.find((a) => a.id === id)?.name ?? id;
  return (
    <article className="card org-card" style={{ ["--c" as string]: c }}>
      <div className="card-band">Level {depth(o.id)}</div>
      <div className="org-head">
        <Avatar name={o.name} color={c} size={48} />
        <h3 style={{ margin: "26px 0 0" }}>{o.name}</h3>
      </div>
      <div className="org-body">
        <p className="chips" style={{ margin: "0 0 4px" }}>
          <span className="chip">
            {parent ? `child of ${parent.name}` : "root"}
          </span>
          <span className="chip">
            {bind ? `account: ${accName(bind.accountId)}` : "no account yet"}
          </span>
          {rule && (
            <span className="chip">
              fee {rule.bps / 100}%
              {rule.flatMinor ? ` + ${rule.flatMinor}` : ""}
              {rule.minMinor != null ? ` min ${rule.minMinor}` : ""}
              {rule.capMinor != null ? ` cap ${rule.capMinor}` : ""} ·{" "}
              {rule.bearer}
            </span>
          )}
        </p>

        <details className="panel">
          <summary>
            <Icon name="link" size={16} />
            Parent
          </summary>
          <form
            onSubmit={(e) => {
              const v = val(e);
              call(
                authClient.nuvion.organization.parent({
                  organizationId: o.id,
                  parentOrganizationId: v.parent || null,
                }),
              );
            }}
          >
            <label className="field">
              <span>Parent organization</span>
              <select name="parent" defaultValue={o.parentOrganizationId ?? ""}>
                <option value="">None (root)</option>
                {s.orgs
                  .filter((x) => x.id !== o.id)
                  .map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
              </select>
            </label>
            <button className="btn primary sm">Set parent</button>
          </form>
        </details>

        <details className="panel">
          <summary>
            <Icon name="key" size={16} />
            Nuvion account
          </summary>
          <p className="hint">
            Each organization needs its <b>own</b> Nuvion account on your
            connected entity: payments for it are credited there, and its shares
            move out of it by book transfer. Two organizations cannot share an
            account, because a transfer needs a different account to land in.{" "}
            {bind ? "Already bound: a binding cannot be changed." : ""}
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              call(
                authClient.nuvion.organization.bind({
                  organizationId: o.id,
                  entityId: conn.entityId!,
                  accountId: acc,
                }),
              );
            }}
          >
            <label className="field">
              <span>Account</span>
              <select
                value={acc}
                onChange={(e) => setAcc(e.target.value)}
                disabled={!!bind}
                required
              >
                <option value="">
                  {accounts.length ? "Choose an account" : "Loading accounts…"}
                </option>
                {accounts.map((a) => {
                  const u = usedBy(a.id);
                  return (
                    <option key={a.id} value={a.id} disabled={!!u}>
                      {a.name} · {a.currency}
                      {a.available != null
                        ? ` · ${money(a.available, a.currency)}`
                        : ""}
                      {u ? ` (used by ${u})` : ""}
                    </option>
                  );
                })}
              </select>
            </label>
            {!bind && (
              <button
                className="btn primary sm"
                disabled={!acc || !conn.entityId}
              >
                Bind
              </button>
            )}
          </form>
        </details>

        {parent && (
          <details className="panel">
            <summary>
              <Icon name="split" size={16} />
              Fee rule
            </summary>
            <p className="hint">
              What <b>{parent.name}</b> takes from <b>{o.name}</b>&apos;s
              payments. Only an admin of {parent.name} can set it. Amounts are
              in minor units (pence).
            </p>
            <form
              key={rule ? "r" : "n"}
              onSubmit={(e) => {
                const v = val(e);
                call(
                  authClient.nuvion.feeRule({
                    organizationId: o.id,
                    flatMinor: Number(v.flat || 0),
                    bps: Number(v.bps || 0),
                    minMinor: v.min ? Number(v.min) : undefined,
                    capMinor: v.cap ? Number(v.cap) : undefined,
                    bearer: v.bearer as "payer" | "merchant",
                  }),
                );
              }}
            >
              <div className="cols">
                <label className="field">
                  <span>Basis points (100 = 1%)</span>
                  <input
                    name="bps"
                    inputMode="numeric"
                    defaultValue={rule?.bps ?? ""}
                  />
                </label>
                <label className="field">
                  <span>Flat</span>
                  <input
                    name="flat"
                    inputMode="numeric"
                    defaultValue={rule?.flatMinor ?? ""}
                  />
                </label>
                <label className="field">
                  <span>Minimum</span>
                  <input
                    name="min"
                    inputMode="numeric"
                    defaultValue={rule?.minMinor ?? ""}
                  />
                </label>
                <label className="field">
                  <span>Cap</span>
                  <input
                    name="cap"
                    inputMode="numeric"
                    defaultValue={rule?.capMinor ?? ""}
                  />
                </label>
                <label className="field">
                  <span>Who bears it</span>
                  <select
                    name="bearer"
                    defaultValue={rule?.bearer ?? "merchant"}
                  >
                    <option value="merchant">Merchant (deducted)</option>
                    <option value="payer">Payer (added to the charge)</option>
                  </select>
                </label>
              </div>
              <button className="btn primary sm">Save fee rule</button>
            </form>
          </details>
        )}
      </div>
    </article>
  );
}

export default function Orgs() {
  const { state, call, toast, refresh, org } = useData();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [busy, setBusy] = useState(false);
  const [prep, setPrep] = useState<
    { from: string; to: string; ok: boolean; message?: string }[] | null
  >(null);
  const connected =
    !!state?.connection.connected && !state.connection.operatorMode;
  const loadAccounts = useCallback(async () => {
    try {
      setAccounts((await settings({ action: "accounts" })).accounts);
    } catch {
      setAccounts([]);
    }
  }, []);
  useEffect(() => {
    if (!connected) return;
    let stopped = false;
    settings({ action: "accounts" })
      .then((r) => {
        if (!stopped) setAccounts(r.accounts);
      })
      .catch(() => {
        if (!stopped) setAccounts([]);
      });
    return () => {
      stopped = true;
    };
  }, [connected]);
  if (!state)
    return (
      <div className="page">
        <p>Loading…</p>
      </div>
    );

  const conn = state.connection;
  const bound = (id: string) =>
    state.bindings.some((b) => b.organizationId === id);
  const unbound = state.orgs.filter((o) => !bound(o.id));
  // dedicated demo accounts, named per organization, so the demo never touches other accounts on the entity
  const demoName = (o: Org) => `better-auth-nuvion: ${o.name}`;
  const existing = (o: Org) =>
    accounts.find(
      (a) =>
        a.name === demoName(o) &&
        a.currency === "GBP" &&
        !state.bindings.some((b) => b.accountId === a.id),
    );
  const toCreate = unbound.filter((o) => !existing(o));
  const withParent = state.orgs.filter(
    (o) =>
      o.parentOrganizationId && bound(o.id) && bound(o.parentOrganizationId),
  );

  // Gives every unbound organization its own dedicated GBP account (reusing one with the same name, creating it otherwise).
  const autoAssign = async () => {
    setBusy(true);
    try {
      for (const o of unbound) {
        const id =
          existing(o)?.id ??
          (await settings({ action: "create-account", name: demoName(o) })).id;
        const r = await authClient.nuvion.organization.bind({
          organizationId: o.id,
          entityId: conn.entityId!,
          accountId: id,
        });
        if (r.error) throw new Error(r.error.message ?? "Bind failed");
      }
      toast("Every organization has its own account");
      await loadAccounts();
      await refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), true);
      await loadAccounts();
      await refresh();
    }
    setBusy(false);
  };

  // Asks the plugin to create the book-transfer counterparties now; it would also do it on the first transfer.
  const prepare = async () => {
    setBusy(true);
    const out: { from: string; to: string; ok: boolean; message?: string }[] =
      [];
    for (const o of withParent) {
      const r = await authClient.nuvion.organization.destinations({
        organizationId: o.id,
      });
      if (r.error) {
        out.push({ from: o.name, to: "", ok: false, message: r.error.message });
        continue;
      }
      for (const x of r.data!.results)
        out.push({
          from: o.name,
          to: org(x.toOrganizationId)?.name ?? "",
          ok: x.status === "ready",
          message: x.message,
        });
    }
    setPrep(out);
    setBusy(false);
    refresh();
  };

  return (
    <>
      <header className="hero small">
        <p className="eyebrow light">Organizations</p>
        <h1>Build the hierarchy.</h1>
        <p>
          An organization is a business that can take payments. Use one, two or
          three levels: a lone merchant keeps everything, a merchant under a
          platform pays it a fee, and a reseller can sit between them. Each
          level takes a fee from the one below it when a payment is split.
        </p>
      </header>
      <main className="page narrow">
        <section className="card pad">
          <h3>How to set this up</h3>
          <ol className="steps-text">
            <li>
              <b>Create</b> one to three organizations, for example Merchant, or
              Platform and Merchant, or Platform, Reseller and Merchant.
            </li>
            <li>
              Open each card below and set the <b>parent</b> (for example
              Merchant under Platform, or Merchant under Reseller under
              Platform). Skip this for a lone organization. Depth is capped at 3
              and cycles are rejected.
            </li>
            <li>
              Give each one its <b>own Nuvion account</b>. Press{" "}
              <b>Give each organization its own account</b>: it creates a
              dedicated GBP account in your sandbox for each organization (or
              reuses one it made before).
            </li>
            <li>
              Set a <b>fee rule</b> on every organization that has a parent:
              what its parent takes from its payments (basis points, a flat
              amount, a minimum, a cap, and who pays it).
            </li>
            <li>
              Press <b>Prepare transfers</b> (optional: it also happens
              automatically on the first split), then go to{" "}
              <Link href="/payments">Payments</Link>.
            </li>
          </ol>
          <p className="hint">
            Shares move between these accounts as real Nuvion book transfers
            (sandbox money). The merchant&apos;s account is credited by the
            checkout, then pays its parents.
          </p>
        </section>
        <form
          className="card pad"
          onSubmit={(e) => {
            const v = val(e);
            const form = e.currentTarget;
            call(
              authClient.organization.create({
                name: v.name,
                slug:
                  v.name.toLowerCase().replace(/\W+/g, "-") +
                  "-" +
                  Math.random().toString(36).slice(2, 6),
              }),
            ).then((r) => {
              if (!r.error) form.reset();
            });
          }}
        >
          <label className="field">
            <span>New organization</span>
            <input
              name="name"
              placeholder="e.g. Platform, Reseller, Merchant"
              required
            />
          </label>
          <button className="btn primary">Create organization</button>
        </form>
        {unbound.length > 0 && connected && (
          <div className="notice">
            <Icon name="key" />
            <span>
              {unbound.length} organization
              {unbound.length > 1 ? "s have" : " has"} no Nuvion account yet.
              {toCreate.length
                ? ` ${toCreate.length} new GBP account${toCreate.length > 1 ? "s" : ""} will be created in your sandbox, named after the organization.`
                : " Matching demo accounts already exist and will be reused."}
            </span>
            <button
              className="btn soft sm"
              disabled={busy}
              onClick={autoAssign}
            >
              Give each organization its own account
            </button>
          </div>
        )}
        {unbound.length > 0 && !connected && !conn.operatorMode && (
          <div className="notice">
            <Icon name="key" />
            <span>
              Connect your Nuvion sandbox to give organizations their accounts.
            </span>
            <Link className="btn soft sm" href="/settings">
              Open Settings
            </Link>
          </div>
        )}
        {withParent.length > 0 && (
          <div className="notice">
            <Icon name="split" />
            <span>
              Splits move money with book transfers, which need a Nuvion
              counterparty for each pair. The plugin creates them itself the
              first time a transfer needs one. You can create them now to catch
              problems early.
            </span>
            <button className="btn soft sm" disabled={busy} onClick={prepare}>
              Prepare transfers
            </button>
          </div>
        )}
        {prep && (
          <section className="card pad">
            <h3>Transfers</h3>
            <ul className="steps-text">
              {prep.map((p, i) => (
                <li key={i}>
                  {p.from}
                  {p.to ? ` → ${p.to}` : ""}:{" "}
                  {p.ok ? (
                    <span className="ok">ready</span>
                  ) : (
                    <span className="err">{p.message}</span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
        {state.orgs.map((o) => (
          <OrgCard key={o.id} o={o} accounts={accounts} />
        ))}
      </main>
    </>
  );
}
