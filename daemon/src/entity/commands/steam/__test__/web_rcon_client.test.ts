import { AddressInfo } from "net";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WebSocketServer } from "ws";
import { executeWebRcon, WebRconError } from "../web_rcon_client";
import WebRconCommand from "../web_rcon_command";
import type Instance from "../../../instance/instance";

let server: WebSocketServer | undefined;

async function listen(options: ConstructorParameters<typeof WebSocketServer>[0] = {}) {
  server = new WebSocketServer({ host: "127.0.0.1", port: 0, ...options });
  await new Promise<void>((resolve) => server!.once("listening", resolve));
  return (server.address() as AddressInfo).port;
}

afterEach(async () => {
  if (!server) return;
  for (const client of server.clients) client.terminate();
  await new Promise<void>((resolve) => server!.close(() => resolve()));
  server = undefined;
});

describe("Rust WebRCON client", () => {
  it("sends the Rust command packet and returns only the matching reply", async () => {
    const port = await listen();
    let path = "";
    let requests = 0;
    server!.on("connection", (socket, request) => {
      path = request.url || "";
      socket.on("message", (raw) => {
        requests++;
        const packet = JSON.parse(raw.toString());
        expect(packet).toEqual({
          Identifier: 1001,
          Message: "gather.rate dispenser * 2",
          Name: "WebRcon"
        });
        socket.send(JSON.stringify({ Identifier: 0, Message: "log message" }));
        socket.send(JSON.stringify({ Identifier: 1001, Message: "rate updated" }));
      });
    });

    const result = await executeWebRcon({
      host: "127.0.0.1",
      port,
      password: "test-secret",
      command: "gather.rate dispenser * 2"
    });
    expect(result).toBe("rate updated");
    expect(path).toBe("/test-secret");
    expect(requests).toBe(1);
  });

  it("encodes special characters in the password path", async () => {
    const port = await listen();
    let path = "";
    server!.on("connection", (socket, request) => {
      path = request.url || "";
      socket.on("message", () => socket.send(JSON.stringify({ Identifier: 1001, Message: "ok" })));
    });
    await executeWebRcon({ host: "127.0.0.1", port, password: "p/a#b", command: "status" });
    expect(path).toBe("/p%2Fa%23b");
  });

  it("rejects malformed replies", async () => {
    const port = await listen();
    server!.on("connection", (socket) => socket.on("message", () => socket.send("not json")));
    await expect(
      executeWebRcon({ host: "127.0.0.1", port, password: "secret", command: "status" })
    ).rejects.toMatchObject({ code: "invalidResponse" });
  });

  it("times out without retrying a command that may already have run", async () => {
    const port = await listen();
    let requests = 0;
    server!.on("connection", (socket) => socket.on("message", () => requests++));
    await expect(
      executeWebRcon({
        host: "127.0.0.1",
        port,
        password: "secret",
        command: "gather.rate dispenser * 2",
        responseTimeoutMs: 40
      })
    ).rejects.toMatchObject({ code: "timeout", commandSent: true });
    expect(requests).toBe(1);
  });

  it("reports a close after sending without leaking the password", async () => {
    const port = await listen();
    server!.on("connection", (socket) => socket.on("message", () => socket.close()));
    const error = await executeWebRcon({
      host: "127.0.0.1",
      port,
      password: "secret",
      command: "quit"
    }).catch((reason) => reason as WebRconError);
    expect(error).toMatchObject({ code: "closed", commandSent: true });
    expect(error.message).not.toContain("secret");
  });

  it("rejects a failed handshake without exposing the password", async () => {
    const port = await listen({ verifyClient: () => false });
    const error = await executeWebRcon({
      host: "127.0.0.1",
      port,
      password: "secret",
      command: "status"
    }).catch((reason) => reason as WebRconError);
    expect(error.code).toBe("handshake");
    expect(error.message).not.toContain("secret");
  });

  it("rejects URLs disguised as hosts and invalid ports", async () => {
    await expect(
      executeWebRcon({ host: "127.0.0.1/path", port: 28016, password: "secret", command: "status" })
    ).rejects.toMatchObject({ code: "invalidTarget" });
    await expect(
      executeWebRcon({ host: "localhost", port: 0, password: "secret", command: "status" })
    ).rejects.toMatchObject({ code: "invalidTarget" });
  });

  it("prints the command result through the instance console", async () => {
    const port = await listen();
    server!.on("connection", (socket) =>
      socket.on("message", () =>
        socket.send(JSON.stringify({ Identifier: 1001, Message: "2 players" }))
      )
    );
    const print = vi.fn();
    const instance = {
      config: { rconIp: "127.0.0.1", rconPort: port, rconPassword: "secret" },
      process: {},
      print,
      println: vi.fn(),
      status: () => 3
    } as unknown as Instance;

    await new WebRconCommand().exec(instance, "status");
    expect(print).toHaveBeenCalledWith("[RCON] <<< status\n");
    expect(print).toHaveBeenCalledWith("[RCON] 2 players\n");
  });

  it("does not report an expected close as an error during shutdown", async () => {
    const port = await listen();
    server!.on("connection", (socket) => socket.on("message", () => socket.close()));
    const println = vi.fn();
    const instance = {
      config: { rconIp: "127.0.0.1", rconPort: port, rconPassword: "secret" },
      process: {},
      print: vi.fn(),
      println,
      status: () => 1
    } as unknown as Instance;

    await new WebRconCommand().exec(instance, "quit");
    expect(println).not.toHaveBeenCalled();
  });

  it("does not contact RCON when its instance is stopped", async () => {
    const port = await listen();
    const connection = vi.fn();
    server!.on("connection", connection);
    const println = vi.fn();
    const instance = {
      config: { rconIp: "127.0.0.1", rconPort: port, rconPassword: "secret" },
      print: vi.fn(),
      println,
      status: () => 0
    } as unknown as Instance;

    await new WebRconCommand().exec(instance, "status");
    expect(connection).not.toHaveBeenCalled();
    expect(println).toHaveBeenCalled();
  });
});
