import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";
import { loadCreds, operatorKey, tenant } from "@/lib/tenant";

const handler = toNextJsHandler(auth);

// Runs plugin calls inside the signed-in visitor's context so nuvionFetch can use their own Nuvion key.
async function run(req: Request, fn: (r: Request) => Promise<Response>) {
  const path = new URL(req.url).pathname;
  if (!path.startsWith("/api/auth/nuvion/") || path.endsWith("/nuvion/webhook")) return fn(req);
  const userId = (await auth.api.getSession({ headers: req.headers }))?.user.id;
  if (userId && path.includes("/nuvion/payments") && !operatorKey() && !(await loadCreds(userId)))
    return Response.json({ code: "NOT_CONNECTED", message: "Connect your Nuvion sandbox on the Settings page first." }, { status: 400 });
  return userId ? tenant.run({ userId }, () => fn(req)) : fn(req);
}

export const GET = (req: Request) => run(req, handler.GET);
export const POST = (req: Request) => run(req, handler.POST);
