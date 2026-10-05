import { isIP } from "net";
import WebSocket from "ws";

export type WebRconErrorCode =
  | "invalidTarget"
  | "missingPassword"
  | "connect"
  | "handshake"
  | "invalidResponse"
  | "timeout"
  | "closed";

export class WebRconError extends Error {
  constructor(public readonly code: WebRconErrorCode, public readonly commandSent = false) {
    super(code);
  }
}

interface WebRconOptions {
  host: string;
  port: number;
  password: string;
  command: string;
  connectTimeoutMs?: number;
  responseTimeoutMs?: number;
}

const IDENTIFIER = 1001;

function targetUrl(host: string, port: number, password: string) {
  const address = host.trim() || "localhost";
  const bareAddress = address.startsWith("[") && address.endsWith("]")
    ? address.slice(1, -1)
    : address;
  const ipv6 = isIP(bareAddress) === 6;
  if (
    (!ipv6 && !/^[A-Za-z0-9_.-]+$/.test(address)) ||
    address.length > 253 ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535
  )
    throw new WebRconError("invalidTarget");
  if (!password) throw new WebRconError("missingPassword");
  return `ws://${ipv6 ? `[${bareAddress}]` : address}:${port}/${encodeURIComponent(password)}`;
}

export async function executeWebRcon({
  host,
  port,
  password,
  command,
  connectTimeoutMs = 6000,
  responseTimeoutMs = 10000
}: WebRconOptions): Promise<string> {
  const url = targetUrl(host, port, password);

  return new Promise((resolve, reject) => {
    let socket: WebSocket;
    let timer: NodeJS.Timeout;
    let settled = false;
    let commandSent = false;

    const finish = (error?: WebRconError, response?: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.terminate();
      if (error) reject(error);
      else resolve(response ?? "");
    };

    try {
      socket = new WebSocket(url, {
        handshakeTimeout: connectTimeoutMs,
        maxPayload: 4 * 1024 * 1024
      });
    } catch {
      reject(new WebRconError("invalidTarget"));
      return;
    }

    timer = setTimeout(() => finish(new WebRconError("connect")), connectTimeoutMs);
    socket.on("open", () => {
      clearTimeout(timer);
      timer = setTimeout(() => finish(new WebRconError("timeout", commandSent)), responseTimeoutMs);
      commandSent = true;
      socket.send(
        JSON.stringify({ Identifier: IDENTIFIER, Message: command, Name: "WebRcon" }),
        (error) => {
          if (error) finish(new WebRconError("closed", commandSent));
        }
      );
    });
    socket.on("message", (raw) => {
      let packet: any;
      try {
        packet = JSON.parse(raw.toString());
      } catch {
        finish(new WebRconError("invalidResponse", commandSent));
        return;
      }
      if (packet?.Identifier !== IDENTIFIER) return;
      if (typeof packet.Message !== "string") {
        finish(new WebRconError("invalidResponse", commandSent));
        return;
      }
      finish(undefined, packet.Message);
    });
    socket.on("unexpected-response", (_request, response) => {
      response.resume();
      finish(new WebRconError("handshake"));
    });
    socket.on("error", () =>
      finish(new WebRconError(commandSent ? "closed" : "connect", commandSent))
    );
    socket.on("close", () => finish(new WebRconError("closed", commandSent)));
  });
}
