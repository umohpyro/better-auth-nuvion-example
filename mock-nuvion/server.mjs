// Tiny Nuvion mock (shapes from nuvion-docs): POST /funding-sessions, POST /transfers, and what the plugin needs to create
// book-transfer counterparties: GET /accounts/{id}, POST /counterparties, POST /payment-details. GET /_calls lists what it received.
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";

const calls = [];
const seen = new Set();
const sessions = new Map(); // funding session id -> what GET /funding-sessions/{id} returns. The mock payer pays instantly: always settled.
const transfers = new Map(); // our unique_reference -> the transfer. The mock settles instantly: always successful.
let failTransfers = null; // POST /_mode {"transfers": 422|500|null} makes POST /transfers fail
createServer((req, res) => {
  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", () => {
    const send = (s, b) => { res.writeHead(s, { "content-type": "application/json" }); res.end(JSON.stringify(b)); };
    if (req.url === "/_calls") return send(200, calls);
    const body = raw ? JSON.parse(raw) : {};
    if (req.method === "POST" && req.url === "/_mode") { failTransfers = body.transfers ?? null; return send(200, { failTransfers }); }
    calls.push({ method: req.method, path: req.url, hasBearer: /^Bearer .+/.test(req.headers.authorization ?? ""), body });
    console.log(req.method, req.url, JSON.stringify(body));
    const acct = /^\/accounts\/([^?]+)/.exec(req.url);
    if (req.method === "GET" && acct) return send(200, { data: { account: { id: acct[1], nuvion_ban: "ban_" + acct[1], currency: "GBP" } } });
    if (req.method === "POST" && req.url === "/counterparties") return send(201, { data: { id: "cp_" + randomUUID().slice(0, 8), ...body } });
    if (req.method === "POST" && req.url === "/payment-details") return send(201, { data: { id: "pd_" + randomUUID().slice(0, 8), ...body } });
    if (req.method === "POST" && req.url === "/funding-sessions") {
      const id = "fs_" + randomUUID().slice(0, 8);
      sessions.set(id, { id, status: "settled", unique_reference: body.unique_reference, amount: body.amount, currency: body.currency });
      return send(201, { data: { id, status: "awaiting_user", ...body, checkout_url: "https://checkout.mock.nuvion.test/" + body.unique_reference } });
    }
    const fsMatch = /^\/funding-sessions\/([^?]+)/.exec(req.url);
    if (req.method === "GET" && fsMatch) return sessions.has(fsMatch[1]) ? send(200, { data: sessions.get(fsMatch[1]) }) : send(404, { type: "error_not_found" });
    if (req.method === "GET" && req.url.startsWith("/transfers?")) {
      const t = transfers.get(new URL(req.url, "http://mock").searchParams.get("unique_reference") ?? "");
      return send(200, { data: t ? [t] : [] });
    }
    const trMatch = /^\/transfers\/([^?]+)/.exec(req.url);
    if (req.method === "GET" && trMatch) {
      const t = [...transfers.values()].find((x) => x.id === trMatch[1]);
      return t ? send(200, { data: t }) : send(404, { type: "error_not_found" });
    }
    if (req.method === "POST" && req.url === "/transfers") {
      if (failTransfers) return send(failTransfers, { type: "error_transfer_simulated_failure" });
      if (seen.has(body.unique_reference)) return send(409, { type: "error_duplicate_reference" });
      seen.add(body.unique_reference);
      const t = { id: "tr_" + randomUUID().slice(0, 8), status: "successful", unique_reference: body.unique_reference };
      transfers.set(body.unique_reference, t);
      return send(201, { data: { ...t, status: "pending", ...body } });
    }
    send(404, { type: "error_not_found" });
  });
}).listen(4010, () => console.log("mock nuvion on :4010"));
