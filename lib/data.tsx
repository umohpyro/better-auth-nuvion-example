"use client";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { authClient } from "./auth-client";

export type Org = { id: string; name: string; parentOrganizationId: string | null };
export type Leg = { id: string; paymentId: string; kind: string; fromOrganizationId: string; toOrganizationId: string; amountMinor: number; state: string; attempt: number; error: string | null; providerRef?: string | null };
export type Payment = { id: string; organizationId: string; reference: string; chargedMinor: number; baseMinor: number; currency: string; status: string; createdAt: number; legs: Leg[] };
export type State = {
  localSimulate: boolean; connection: { connected: boolean; operatorMode: boolean; entityId: string | null; accountId: string | null; webhookSecretSet: boolean }; orgs: Org[]; bindings: { organizationId: string; entityId: string; accountId: string }[];
  rules: { organizationId: string; flatMinor: number; bps: number; minMinor: number | null; capMinor: number | null; bearer: string }[];
  destinations: { fromOrganizationId: string; toOrganizationId: string }[]; payments: Payment[];
};
type Ctx = {
  state: State | null; refresh: () => Promise<void>; toast: (v: unknown, bad?: boolean) => void;
  org: (id: string) => Org | undefined; depth: (id: string) => number;
  call: (p: Promise<{ data: unknown; error: unknown }>) => Promise<{ data: any; error: any }>;
  demo: (action: string, paymentId?: string) => Promise<any>;
};
const C = createContext<Ctx>(null as never);
export const useData = () => useContext(C);

export function DataProvider({ children }: { children: ReactNode }) {
  const session = authClient.useSession();
  const [state, setState] = useState<State | null>(null);
  const [msg, setMsg] = useState<{ v: unknown; bad: boolean } | null>(null);
  const refresh = useCallback(async () => { const r = await fetch("/api/demo"); if (r.ok) setState(await r.json()); }, []);
  useEffect(() => { if (session.data) refresh(); else setState(null); }, [session.data, refresh]);
  const toast = useCallback((v: unknown, bad = false) => { setMsg({ v, bad }); setTimeout(() => setMsg(null), 6000); }, []);
  const org = (id: string) => state?.orgs.find((o) => o.id === id);
  const depth = (id: string) => { let d = 1, o = org(id); while (o?.parentOrganizationId) { d++; o = org(o.parentOrganizationId); } return d; };
  const call: Ctx["call"] = async (p) => {
    const r: any = await p;
    if (r.error) toast(r.error.message ?? r.error, true); else toast("Saved");
    await refresh();
    return r;
  };
  const demo: Ctx["demo"] = async (action, paymentId) => {
    const r = await fetch("/api/demo", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, paymentId }) });
    const j = await r.json();
    toast(j, !r.ok);
    await refresh();
    return j;
  };
  return (
    <C.Provider value={{ state, refresh, toast, org, depth, call, demo }}>
      {children}
      {msg && <div className={"toast" + (msg.bad ? " bad" : "")} role="status">{typeof msg.v === "string" ? msg.v : <pre>{JSON.stringify(msg.v, null, 2)}</pre>}</div>}
    </C.Provider>
  );
}
