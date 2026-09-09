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
  | { type: "region"; region: unknown }
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
    this.onStatus("connecting");

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    this.pc = pc;

    const ws = new WebSocket(toSignalingWsUrl(this.signalingUrl, this.roomCode));
    this.ws = ws;

    const send = (payload: unknown) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload));
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) send({ type: "ice", candidate: event.candidate });
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed" || pc.connectionState === "closed") {
        this.onStatus("error");
      }
    };

    const setupChannel = (channel: RTCDataChannel) => {
      this.channel = channel;
      channel.onopen = () => this.onStatus("connected");
      channel.onclose = () => this.onStatus("closed");
      channel.onerror = () => this.onStatus("error");
      channel.onmessage = (event) => {
        try {
          this.onMessage(JSON.parse(event.data) as LiveShareMessage);
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
      this.onStatus("waiting-for-peer");
      if (this.role === "guest") send({ type: "hello" });
    };

    ws.onmessage = async (event) => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }

      if (msg.type === "hello" && this.role === "host") {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        send({ type: "offer", offer });
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
    };

    ws.onerror = () => this.onStatus("error");
    ws.onclose = () => {
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
      this.channel.send(JSON.stringify(message));
      return true;
    }
    return false;
  }

  close() {
    this.channel?.close();
    this.pc?.close();
    this.ws?.close();
    this.channel = null;
    this.pc = null;
    this.ws = null;
  }
}
