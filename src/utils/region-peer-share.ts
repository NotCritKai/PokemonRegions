/**
 * Live peer-to-peer region sharing.
 *
 * Region data is sent directly between the two participating devices over a
 * WebRTC data channel. The Cloudflare Worker "signaling" service is only
 * used briefly to exchange connection-setup messages (SDP offers/answers
 * and ICE candidates) so the two devices can find each other; it never
 * receives, stores, or forwards region data itself.
 *
 * This only works on the web build, where the browser's WebRTC and
 * WebSocket APIs are available.
 */

export type LiveShareRole = "host" | "guest";

export type LiveShareStatus =
  | "connecting"
  | "waiting-for-peer"
  | "connected"
  | "closed"
  | "error";

export type LiveShareMessage =
  | { type: "region"; region: unknown; permission?: "view" | "edit" | "comment" }
  | { type: "comment"; text: string }
  | { type: "edit"; region: unknown };

// Default public signaling service deployed for this app. Only relays
// short-lived WebRTC connection-setup messages; see backend/src/index.ts.
export const DEFAULT_SIGNALING_URL =
  "https://backend.braylonringo525.workers.dev";

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
];

export function isLiveShareSupported() {
  return (
    typeof window !== "undefined" &&
    typeof window.RTCPeerConnection !== "undefined" &&
    typeof window.WebSocket !== "undefined"
  );
}

export function generateRoomCode() {
  const bytes = new Uint8Array(12);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

export function buildLiveShareLink(
  roomCode: string,
  permission: "view" | "edit" | "comment",
) {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams({ live: roomCode, permission });
  return `${window.location.origin}/my-regions?${params.toString()}`;
}

function toSignalingWsUrl(baseUrl: string, roomCode: string) {
  const wsBase = baseUrl.replace(/^http/, "ws").replace(/\/$/, "");
  return `${wsBase}/room/${roomCode}`;
}

export class LiveShareSession {
  private connectionTimer: ReturnType<typeof setTimeout> | null = null;

  private clearConnectionTimer() {
    if (this.connectionTimer !== null) clearTimeout(this.connectionTimer);
    this.connectionTimer = null;
  }

  private startConnectionTimer() {
    this.clearConnectionTimer();
    this.connectionTimer = setTimeout(() => {
      this.close();
      this.onStatus("error");
    }, 30000);
  }

  private ws: WebSocket | null = null;
  private pc: RTCPeerConnection | null = null;
  private channel: RTCDataChannel | null = null;
  private pendingCandidates: RTCIceCandidateInit[] = [];
  private role: LiveShareRole;
  private roomCode: string;
  private signalingUrl: string;

  onStatus: (status: LiveShareStatus) => void = () => {};
  onMessage: (message: LiveShareMessage) => void = () => {};

  constructor(
    roomCode: string,
    role: LiveShareRole,
    signalingUrl: string = DEFAULT_SIGNALING_URL,
  ) {
    this.roomCode = roomCode;
    this.role = role;
    this.signalingUrl = signalingUrl;
  }

  connect() {
    this.close();
    this.onStatus("connecting");
    this.startConnectionTimer();

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    this.pc = pc;

    const ws = new WebSocket(toSignalingWsUrl(this.signalingUrl, this.roomCode));
    this.ws = ws;

    const send = (payload: unknown) => {
      if (this.ws === ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload));
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) send({ type: "ice", candidate: event.candidate });
    };

    pc.onconnectionstatechange = () => {
      if (this.pc !== pc) return;
      if (pc.connectionState === "disconnected") { this.startConnectionTimer(); this.onStatus("connecting"); }
      if (pc.connectionState === "connected" && this.channel?.readyState === "open") { this.clearConnectionTimer(); this.onStatus("connected"); }
      if (pc.connectionState === "failed" || pc.connectionState === "closed") {
        this.onStatus("error");
      }
    };

    const setupChannel = (channel: RTCDataChannel) => {
      this.channel = channel;
      channel.onopen = () => { if (this.pc === pc) { this.clearConnectionTimer(); this.onStatus("connected"); } };
      channel.onclose = () => { if (this.pc === pc) this.onStatus("closed"); };
      channel.onerror = () => { if (this.pc === pc) this.onStatus("error"); };
      channel.onmessage = (event) => {
        try {
          if (this.pc !== pc) return;
          const message = JSON.parse(event.data);
          if (message && typeof message === "object" && ["region", "comment", "edit"].includes(message.type)) this.onMessage(message as LiveShareMessage);
        } catch {
          // Ignore malformed messages instead of crashing the session.
        }
      };
    };

    if (this.role === "host") {
      setupChannel(pc.createDataChannel("region-share"));
    } else {
      pc.ondatachannel = (event) => setupChannel(event.channel);
    }

    ws.onopen = () => {
      if (this.ws !== ws) return;
      if (this.role === "host") this.clearConnectionTimer();
      this.onStatus("waiting-for-peer");
      send({ type: this.role === "guest" ? "hello" : "ready" });
    };

    let creatingOffer = false;
    ws.onmessage = async (event) => {
      if (this.ws !== ws) return;
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }

      try {
        if (msg.type === "ready" && this.role === "guest") {
          if (pc.remoteDescription) this.connect();
          else send({ type: "hello" });
          return;
        }
        if (msg.type === "hello" && this.role === "host") {
          if (pc.remoteDescription || pc.connectionState === "failed" || pc.connectionState === "closed") {
            this.connect();
            return;
          }
          if (creatingOffer || pc.signalingState === "have-local-offer") return;
          this.startConnectionTimer();
          creatingOffer = true;
          try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            send({ type: "offer", offer });
          } finally {
            creatingOffer = false;
          }
          return;
        }

        if (msg.type === "offer" && this.role === "guest") {
          await pc.setRemoteDescription(
            msg.offer as RTCSessionDescriptionInit,
          );
          await this.flushPendingCandidates();
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          send({ type: "answer", answer });
          return;
        }

        if (msg.type === "answer" && this.role === "host") {
          await pc.setRemoteDescription(
            msg.answer as RTCSessionDescriptionInit,
          );
          await this.flushPendingCandidates();
          return;
        }

        if (msg.type === "ice" && msg.candidate) {
          const candidate = msg.candidate as RTCIceCandidateInit;
          if (pc.remoteDescription) {
            try {
              await pc.addIceCandidate(candidate);
            } catch {
              // Ignore invalid/duplicate candidates.
            }
          } else {
            this.pendingCandidates.push(candidate);
          }
        }
      } catch {
        if (this.ws === ws) this.onStatus("error");
      }
    };

    ws.onerror = () => { if (this.ws === ws) this.onStatus("error"); };
    ws.onclose = () => {
      if (this.ws !== ws) return;
      if (this.channel?.readyState !== "open") this.onStatus("closed");
    };
  }

  private async flushPendingCandidates() {
    const pc = this.pc;
    if (!pc) return;
    const queued = this.pendingCandidates;
    this.pendingCandidates = [];
    for (const candidate of queued) {
      try {
        await pc.addIceCandidate(candidate);
      } catch {
        // Ignore invalid/duplicate candidates.
      }
    }
  }

  send(message: LiveShareMessage) {
    if (this.channel?.readyState === "open") {
      try {
        this.channel.send(JSON.stringify(message));
        return true;
      } catch {
        this.onStatus("error");
        return false;
      }
    }
    return false;
  }

  close() {
    this.clearConnectionTimer();
    const channel = this.channel;
    const pc = this.pc;
    const ws = this.ws;
    this.channel = null;
    this.pc = null;
    this.ws = null;
    this.pendingCandidates = [];
    channel?.close();
    pc?.close();
    ws?.close();
  }
}
