interface RconConfigUpdate {
  rconProtocol?: unknown;
  rconIp?: unknown;
  rconPort?: unknown;
  rconPassword?: unknown;
  enableRcon?: unknown;
}

const RCON_KEYS = ["rconProtocol", "rconIp", "rconPort", "rconPassword", "enableRcon"] as const;

export function hasRconConfigUpdate(config?: RconConfigUpdate | null): boolean {
  return RCON_KEYS.some((key) => config?.[key] != null);
}

export function isWebRconConfigUpdate(
  currentProtocol: string,
  config?: RconConfigUpdate | null
): boolean {
  return (
    config?.rconProtocol === "rust-web" ||
    (currentProtocol === "rust-web" && hasRconConfigUpdate(config))
  );
}
