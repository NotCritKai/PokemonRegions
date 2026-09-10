/**
 * PokemonRegions backend service.
 *
 * Provides:
 * - Peer-to-peer WebRTC signaling (SignalingRoom Durable Object)
 * - User account authentication (Cloudflare D1)
 * - Cloud data sync across devices
 */

const ROOM_ID_PATTERN = /^[a-zA-Z0-9_-]{6,64}$/;
const ROOM_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes of inactivity

export interface Env {
	SIGNALING_ROOM: DurableObjectNamespace;
	DB: D1Database;
}

export class SignalingRoom {
	state: DurableObjectState;
	sockets: Set<WebSocket> = new Set();
	timeoutHandle: ReturnType<typeof setTimeout> | null = null;

	constructor(state: DurableObjectState) {
		this.state = state;
	}

	scheduleClose() {
		if (this.timeoutHandle) clearTimeout(this.timeoutHandle);
		this.timeoutHandle = setTimeout(() => {
			for (const socket of this.sockets) {
				try {
					socket.close(1000, "room-timeout");
				} catch {
					// socket may already be closed
				}
			}
			this.sockets.clear();
		}, ROOM_TIMEOUT_MS);
	}

	async fetch(request: Request): Promise<Response> {
		if (request.headers.get("Upgrade") !== "websocket") {
			return new Response("Expected a WebSocket upgrade request", {
				status: 426,
			});
		}

		// Only two peers may occupy a signaling room at a time.
		if (this.sockets.size >= 2) {
			return new Response("Room is full", { status: 409 });
		}

		const pair = new WebSocketPair();
		const [client, server] = Object.values(pair);

		server.accept();
		this.sockets.add(server);
		this.scheduleClose();

		server.addEventListener("message", (event) => {
			// Relay every message verbatim to the other peer only.
			for (const socket of this.sockets) {
				if (socket !== server) {
					socket.send(event.data);
				}
			}
			this.scheduleClose();
		});

		const cleanup = () => {
			this.sockets.delete(server);
		};
		server.addEventListener("close", cleanup);
		server.addEventListener("error", cleanup);

		return new Response(null, { status: 101, webSocket: client });
	}
}

function withCors(response: Response): Response {
	const headers = new Headers(response.headers);
	headers.set("Access-Control-Allow-Origin", "*");
	headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS, DELETE");
	headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers,
	});
}

function bytesToHex(bytes: Uint8Array): string {
	return Array.from(bytes)
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

function hexToBytes(hex: string): Uint8Array {
	const bytes = new Uint8Array(hex.length / 2);
	for (let i = 0; i < hex.length; i += 2) {
		bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
	}
	return bytes;
}

async function hashPassword(password: string, saltHex?: string): Promise<{ hash: string; salt: string }> {
	const saltBytes = saltHex
		? hexToBytes(saltHex)
		: crypto.getRandomValues(new Uint8Array(16));
	const saltHexResult = saltHex || bytesToHex(saltBytes);

	const enc = new TextEncoder();
	const keyMaterial = await crypto.subtle.importKey(
		"raw",
		enc.encode(password),
		"PBKDF2",
		false,
		["deriveBits"]
	);
	const derivedBits = await crypto.subtle.deriveBits(
		{
			name: "PBKDF2",
			salt: saltBytes.buffer as ArrayBuffer,
			iterations: 100000,
			hash: "SHA-256",
		},
		keyMaterial,
		256
	);
	const hashHex = bytesToHex(new Uint8Array(derivedBits));
	return { hash: hashHex, salt: saltHexResult };
}

function generateToken(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(32));
	return bytesToHex(bytes);
}

async function getAuthenticatedUser(request: Request, env: Env): Promise<{ id: string; username: string } | null> {
	const authHeader = request.headers.get("Authorization");
	if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
	const token = authHeader.substring(7).trim();
	if (!token) return null;

	const now = Date.now();
	const { results } = await env.DB.prepare(
		`SELECT s.user_id, u.username 
		 FROM sessions s 
		 JOIN users u ON s.user_id = u.id 
		 WHERE s.token = ? AND s.expires_at > ?`
	)
		.bind(token, now)
		.all<{ user_id: string; username: string }>();

	if (!results || results.length === 0) return null;
	return { id: results[0].user_id, username: results[0].username };
}

export default {
	async fetch(request, env, ctx): Promise<Response> {
		const url = new URL(request.url);

		if (request.method === "OPTIONS") {
			return withCors(new Response(null, { status: 204 }));
		}

		if (url.pathname === "/" || url.pathname === "/health") {
			return withCors(
				new Response(
					JSON.stringify({
						service: "pokemon-regions-backend",
						status: "ok",
						accountsEnabled: true,
					}),
					{ headers: { "content-type": "application/json" } }
				)
			);
		}

		// Auth API
		if (url.pathname === "/api/auth/register" && request.method === "POST") {
			try {
				const body = (await request.json()) as { username?: string; password?: string };
				const username = body.username?.trim();
				const password = body.password;

				if (!username || username.length < 3 || username.length > 30 || !/^[a-zA-Z0-9_-]+$/.test(username)) {
					return withCors(
						new Response(
							JSON.stringify({ error: "Username must be 3-30 characters (letters, numbers, _, -)" }),
							{ status: 400, headers: { "content-type": "application/json" } }
						)
					);
				}
				if (!password || password.length < 6) {
					return withCors(
						new Response(
							JSON.stringify({ error: "Password must be at least 6 characters long" }),
							{ status: 400, headers: { "content-type": "application/json" } }
						)
					);
				}

				const existing = await env.DB.prepare(
					"SELECT id FROM users WHERE LOWER(username) = LOWER(?)"
				)
					.bind(username)
					.first();
				if (existing) {
					return withCors(
						new Response(
							JSON.stringify({ error: "Username is already taken" }),
							{ status: 400, headers: { "content-type": "application/json" } }
						)
					);
				}

				const { hash, salt } = await hashPassword(password);
				const userId = crypto.randomUUID();
				const now = Date.now();

				await env.DB.prepare(
					"INSERT INTO users (id, username, password_hash, salt, created_at) VALUES (?, ?, ?, ?, ?)"
				)
					.bind(userId, username, hash, salt, now)
					.run();

				const token = generateToken();
				const expiresAt = now + 30 * 24 * 60 * 60 * 1000; // 30 days

				await env.DB.prepare(
					"INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)"
				)
					.bind(token, userId, now, expiresAt)
					.run();

				await env.DB.prepare(
					"INSERT INTO user_data (user_id, regions_json, custom_pokemon_json, gimmicks_json, updated_at) VALUES (?, '[]', '[]', '[]', ?)"
				)
					.bind(userId, now)
					.run();

				return withCors(
					new Response(
						JSON.stringify({ success: true, token, user: { id: userId, username } }),
						{ headers: { "content-type": "application/json" } }
					)
				);
			} catch (e: any) {
				return withCors(
					new Response(JSON.stringify({ error: e?.message || "Registration failed" }), {
						status: 500,
						headers: { "content-type": "application/json" },
					})
				);
			}
		}

		if (url.pathname === "/api/auth/login" && request.method === "POST") {
			try {
				const body = (await request.json()) as { username?: string; password?: string };
				const username = body.username?.trim();
				const password = body.password;

				if (!username || !password) {
					return withCors(
						new Response(
							JSON.stringify({ error: "Username and password are required" }),
							{ status: 400, headers: { "content-type": "application/json" } }
						)
					);
				}

				const user = await env.DB.prepare(
					"SELECT id, username, password_hash, salt FROM users WHERE LOWER(username) = LOWER(?)"
				)
					.bind(username)
					.first<{ id: string; username: string; password_hash: string; salt: string }>();

				if (!user) {
					return withCors(
						new Response(
							JSON.stringify({ error: "Invalid username or password" }),
							{ status: 400, headers: { "content-type": "application/json" } }
						)
					);
				}

				const { hash } = await hashPassword(password, user.salt);
				if (hash !== user.password_hash) {
					return withCors(
						new Response(
							JSON.stringify({ error: "Invalid username or password" }),
							{ status: 400, headers: { "content-type": "application/json" } }
						)
					);
				}

				const token = generateToken();
				const now = Date.now();
				const expiresAt = now + 30 * 24 * 60 * 60 * 1000;

				await env.DB.prepare(
					"INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)"
				)
					.bind(token, user.id, now, expiresAt)
					.run();

				return withCors(
					new Response(
						JSON.stringify({ success: true, token, user: { id: user.id, username: user.username } }),
						{ headers: { "content-type": "application/json" } }
					)
				);
			} catch (e: any) {
				return withCors(
					new Response(JSON.stringify({ error: e?.message || "Login failed" }), {
						status: 500,
						headers: { "content-type": "application/json" },
					})
				);
			}
		}

		if (url.pathname === "/api/auth/me" && request.method === "GET") {
			const user = await getAuthenticatedUser(request, env);
			if (!user) {
				return withCors(
					new Response(JSON.stringify({ error: "Unauthorized" }), {
						status: 401,
						headers: { "content-type": "application/json" },
					})
				);
			}
			return withCors(
				new Response(JSON.stringify({ success: true, user }), {
					headers: { "content-type": "application/json" },
				})
			);
		}

		if (url.pathname === "/api/auth/logout" && request.method === "POST") {
			const authHeader = request.headers.get("Authorization");
			if (authHeader && authHeader.startsWith("Bearer ")) {
				const token = authHeader.substring(7).trim();
				await env.DB.prepare("DELETE FROM sessions WHERE token = ?").bind(token).run();
			}
			return withCors(
				new Response(JSON.stringify({ success: true }), {
					headers: { "content-type": "application/json" },
				})
			);
		}

		// Sync API
		if (url.pathname === "/api/sync" && request.method === "GET") {
			const user = await getAuthenticatedUser(request, env);
			if (!user) {
				return withCors(
					new Response(JSON.stringify({ error: "Unauthorized" }), {
						status: 401,
						headers: { "content-type": "application/json" },
					})
				);
			}

			const row = await env.DB.prepare(
				"SELECT regions_json, custom_pokemon_json, gimmicks_json, updated_at FROM user_data WHERE user_id = ?"
			)
				.bind(user.id)
				.first<{ regions_json: string; custom_pokemon_json: string; gimmicks_json: string; updated_at: number }>();

			let regions = [];
			let customPokemon = [];
			let gimmicks = [];
			let updatedAt = 0;

			if (row) {
				try { regions = JSON.parse(row.regions_json || "[]"); } catch {}
				try { customPokemon = JSON.parse(row.custom_pokemon_json || "[]"); } catch {}
				try { gimmicks = JSON.parse(row.gimmicks_json || "[]"); } catch {}
				updatedAt = row.updated_at || 0;
			}

			return withCors(
				new Response(
					JSON.stringify({
						success: true,
						data: { regions, customPokemon, gimmicks, updatedAt },
					}),
					{ headers: { "content-type": "application/json" } }
				)
			);
		}

		if (url.pathname === "/api/sync" && request.method === "POST") {
			const user = await getAuthenticatedUser(request, env);
			if (!user) {
				return withCors(
					new Response(JSON.stringify({ error: "Unauthorized" }), {
						status: 401,
						headers: { "content-type": "application/json" },
					})
				);
			}

			try {
				const body = (await request.json()) as {
					regions?: any[];
					customPokemon?: any[];
					gimmicks?: any[];
				};

				const regionsJson = JSON.stringify(body.regions ?? []);
				const customPokemonJson = JSON.stringify(body.customPokemon ?? []);
				const gimmicksJson = JSON.stringify(body.gimmicks ?? []);
				const now = Date.now();

				await env.DB.prepare(
					`INSERT INTO user_data (user_id, regions_json, custom_pokemon_json, gimmicks_json, updated_at)
					 VALUES (?, ?, ?, ?, ?)
					 ON CONFLICT(user_id) DO UPDATE SET
					   regions_json = excluded.regions_json,
					   custom_pokemon_json = excluded.custom_pokemon_json,
					   gimmicks_json = excluded.gimmicks_json,
					   updated_at = excluded.updated_at`
				)
					.bind(user.id, regionsJson, customPokemonJson, gimmicksJson, now)
					.run();

				return withCors(
					new Response(
						JSON.stringify({ success: true, updatedAt: now }),
						{ headers: { "content-type": "application/json" } }
					)
				);
			} catch (e: any) {
				return withCors(
					new Response(JSON.stringify({ error: e?.message || "Sync failed" }), {
						status: 500,
						headers: { "content-type": "application/json" },
					})
				);
			}
		}

		// Rooms are addressed as /room/<one-time-room-code>
		const match = url.pathname.match(/^\/room\/([^/]+)$/);
		if (!match) {
			return withCors(new Response("Not found", { status: 404 }));
		}

		const roomId = match[1];
		if (!ROOM_ID_PATTERN.test(roomId)) {
			return withCors(new Response("Invalid room code", { status: 400 }));
		}

		const id = env.SIGNALING_ROOM.idFromName(roomId);
		const stub = env.SIGNALING_ROOM.get(id);
		return stub.fetch(request);
	},
} satisfies ExportedHandler<Env>;

