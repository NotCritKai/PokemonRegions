/**
 * PokemonRegions peer-to-peer signaling service.
 *
 * This Worker never stores or reads region data. It only relays short-lived
 * WebRTC connection-setup messages (SDP offers/answers and ICE candidates)
 * between exactly two devices that share the same one-time room code, so
 * the actual region data can travel directly between those two devices.
 *
 * Each room is backed by a Durable Object that holds messages only in
 * memory for the lifetime of the connection and is discarded once both
 * peers disconnect or the room times out.
 */

const ROOM_ID_PATTERN = /^[a-zA-Z0-9_-]{6,64}$/;
const ROOM_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes of inactivity

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
			// Relay every message verbatim to the other peer only. This Worker
			// does not parse, log, or persist message contents.
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
	headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
	headers.set("Access-Control-Allow-Headers", "Content-Type");
	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers,
	});
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
						service: "pokemon-regions-signaling",
						status: "ok",
						note: "This service only relays temporary WebRTC connection setup messages. It does not store region data.",
					}),
					{ headers: { "content-type": "application/json" } },
				),
			);
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
