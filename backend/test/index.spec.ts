import { env } from "cloudflare:workers";
import schema from "../schema.sql?raw";
import { SELF, reset } from "cloudflare:test";
import { describe, it, expect, beforeEach, afterEach } from "vitest";

describe("Pokemon Regions backend", () => {
	it("reports a healthy service response", async () => {
		const response = await SELF.fetch("https://example.com/health");

		expect(response.status).toBe(200);
		expect(response.headers.get("access-control-allow-origin")).toBe("*");
		await expect(response.json()).resolves.toMatchObject({
			service: "pokemon-regions-backend",
			status: "ok",
			accountsEnabled: true,
		});
	});

	it("answers CORS preflight requests", async () => {
		const response = await SELF.fetch("https://example.com/api/auth/login", {
			method: "OPTIONS",
		});

		expect(response.status).toBe(204);
		expect(response.headers.get("access-control-allow-methods")).toContain("POST");
	});
});

// Isolated local bindings; these tests never touch the deployed database.
beforeEach(async () => { await env.DB.exec(schema.replace(/\n/g, " ")); });
afterEach(async () => { await reset(); });
const request = async (path: string, body?: unknown, token?: string) => {
  let payload = body;
  if (path === "/api/sync" && body && typeof body === "object" && token && !("expectedUpdatedAt" in body)) {
    const current = await SELF.fetch("https://example.com/api/sync", {headers:{authorization: `Bearer ${token}`}});
    const json = await current.json() as {data?: {updatedAt: number}};
    payload = {...body, expectedUpdatedAt: json.data?.updatedAt ?? 0};
  }
  return SELF.fetch(`https://example.com${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {"content-type": "application/json", ...(token ? {authorization: `Bearer ${token}`} : {})},
    ...(body === undefined ? {} : {body: JSON.stringify(payload)}),
  });
};

async function register(username: string) {
  const response = await request("/api/auth/register", {username, password: "testing-password"});
  expect(response.status).toBe(200);
  return await response.json() as {token: string};
}
it("rejects malformed auth input and unauthenticated sync", async () => {
  for (const body of [null, {}, {username: 42, password: []}]) {
    expect((await request("/api/auth/register", body)).status).toBe(400);
    expect((await request("/api/auth/login", body)).status).toBe(400);
  }
  expect((await request("/api/sync")).status).toBe(401);
  expect((await request("/api/sync", {})).status).toBe(401);
});
it("authenticates case-insensitively and invalidates logout sessions", async () => {
  const {token} = await register("TestUser");
  expect((await request("/api/auth/register", {username: "testuser", password: "testing-password"})).status).toBe(400);
  expect((await request("/api/auth/login", {username: "TESTUSER", password: "wrong-password"})).status).toBe(400);
  expect((await request("/api/auth/login", {username: "TESTUSER", password: "testing-password"})).status).toBe(200);
  expect((await request("/api/auth/me", undefined, token)).status).toBe(200);
  expect((await request("/api/auth/logout", {}, token)).status).toBe(200);
  expect((await request("/api/sync", undefined, token)).status).toBe(401);
});
it("preserves omitted sync collections and isolates accounts", async () => {
  const owner = await register("Owner"); const other = await register("Other");
  expect((await request("/api/sync", {regions:[{name:"Private"}],gimmicks:[{name:"Mega"}]}, owner.token)).status).toBe(200);
  expect((await request("/api/sync", {customPokemon:[{name:"Custom"}]}, owner.token)).status).toBe(200);
  expect(await (await request("/api/sync", undefined, owner.token)).json()).toMatchObject({data:{regions:[{name:"Private"}],gimmicks:[{name:"Mega"}],customPokemon:[{name:"Custom"}]}});
  expect(await (await request("/api/sync", undefined, other.token)).json()).toMatchObject({data:{regions:[],gimmicks:[],customPokemon:[]}});
  expect((await request("/api/sync", {regions:null}, owner.token)).status).toBe(400);
  expect((await request("/api/sync", {regions:[]}, owner.token)).status).toBe(200);
  expect(await (await request("/api/sync", undefined, owner.token)).json()).toMatchObject({data:{regions:[],gimmicks:[{name:"Mega"}]}});
});
it("validates room identifiers and requires a websocket upgrade", async () => {
  expect((await request("/room/short")).status).toBe(400);
  expect((await request("/room/test-room-123")).status).toBe(426);
});
it("relays signaling between two peers and rejects a third peer", async () => {
  const connect = () => SELF.fetch("https://example.com/room/test-room-relay", {headers:{Upgrade:"websocket"}});
  const first = await connect(); const second = await connect();
  expect(first.status).toBe(101); expect(second.status).toBe(101);
  const a = first.webSocket!; const b = second.webSocket!;
  a.accept(); b.accept();
  try {
    expect((await connect()).status).toBe(409);
    const received = new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("No signaling relay")), 1000);
      b.addEventListener("message", event => { clearTimeout(timer); resolve(String(event.data)); }, {once:true});
    });
    a.send(JSON.stringify({type:"hello"}));
    expect(await received).toBe('{"type":"hello"}');
  } finally { a.close(); b.close(); }
});

it("rejects stale writes without changing the winning cloud copy", async () => {
  const {token} = await register("Concurrent");
  const snapshot = await (await request("/api/sync", undefined, token)).json() as {data:{updatedAt:number}};
  const expectedUpdatedAt = snapshot.data.updatedAt;
  expect((await request("/api/sync", {regions:[{name:"Winner"}],expectedUpdatedAt}, token)).status).toBe(200);
  expect((await request("/api/sync", {regions:[{name:"Stale"}],expectedUpdatedAt}, token)).status).toBe(409);
  expect(await (await request("/api/sync", undefined, token)).json()).toMatchObject({data:{regions:[{name:"Winner"}],syncProtocol:2}});
});
