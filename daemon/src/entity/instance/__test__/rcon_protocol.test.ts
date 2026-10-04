import { describe, expect, it } from "vitest";
import Instance from "../instance";
import InstanceConfig from "../Instance_config";

describe("instance RCON protocol configuration", () => {
  it("defaults old instances to Source RCON", () => {
    const config = new InstanceConfig();
    expect(config.rconProtocol).toBe("source");
  });

  it("accepts a protocol change while stopped", () => {
    const instance = new Instance("rcon-test", new InstanceConfig());
    instance.parameters({ rconProtocol: "rust-web" }, false);
    expect(instance.config.rconProtocol).toBe("rust-web");
  });

  it("rejects invalid protocols without changing the instance", () => {
    const instance = new Instance("rcon-test", new InstanceConfig());
    expect(() => instance.parameters({ rconProtocol: "arbitrary" }, false)).toThrow();
    expect(instance.config.rconProtocol).toBe("source");
  });

  it("does not switch protocols on a running instance", () => {
    const instance = new Instance("rcon-test", new InstanceConfig());
    instance.status(Instance.STATUS_RUNNING);
    expect(() => instance.parameters({ rconProtocol: "rust-web" }, false)).toThrow();
    expect(instance.config.rconProtocol).toBe("source");
  });
});
