import fs from "fs-extra";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type Instance from "../../../entity/instance/instance";
import { QuickInstallTask } from "../quick_install";

const mocks = vi.hoisted(() => ({
  info: vi.fn(),
  error: vi.fn(),
  readFile: vi.fn()
}));
vi.mock("../../log", () => ({ default: { info: mocks.info, error: mocks.error } }));
vi.mock("../../file_router_service", () => ({
  getFileManager: () => ({
    readFile: mocks.readFile,
    toAbsolutePath: (file: string) => `/isolated-test/${file}`
  })
}));
vi.mock("../../../entity/instance/instance", () => ({
  default: class {
    static STATUS_BUSY = 1;
    static STATUS_STOP = 0;
  }
}));
vi.mock("../../../entity/instance/Instance_config", () => ({ default: class {} }));
vi.mock("../../system_instance", () => ({ default: { createInstance: vi.fn() } }));
vi.mock("../../instance_update_action", () => ({ InstanceUpdateAction: class {} }));
vi.mock("../../../i18n", () => ({ $t: (key: string) => key }));
vi.mock("i18next", () => ({ t: (key: string) => key }));

beforeEach(() => {
  mocks.info.mockReset();
  mocks.error.mockReset();
  mocks.readFile.mockReset();
});
afterEach(() => vi.restoreAllMocks());

describe("quick install config logging", () => {
  it.each(["build parameters", "archive preset"])(
    "applies %s without logging passwords, environment values or commands",
    async (source) => {
      const config = {
        startCommand: "server --token command-secret",
        rconPassword: "rcon-secret",
        docker: { env: ["TOKEN=environment-secret"] }
      };
      const instance = {
        instanceUuid: "test-instance",
        config: { nickname: "test server", processType: "general", updateCommand: "" },
        print: vi.fn(),
        println: vi.fn(),
        status: vi.fn(),
        resetConfigWithoutDocker: vi.fn(),
        parameters: vi.fn()
      };
      const usePreset = source === "archive preset";
      vi.spyOn(fs, "existsSync").mockImplementation(
        (file) => usePreset && file === "mcsmanager-config.json"
      );
      mocks.readFile.mockResolvedValue(JSON.stringify(config));
      const task = new QuickInstallTask(
        "test server",
        undefined,
        usePreset ? undefined : (config as IGlobalInstanceConfig),
        instance as unknown as Instance
      );
      await task.start();
      await task.wait();

      expect(instance.parameters).toHaveBeenCalledWith(config, true);
      expect(instance.resetConfigWithoutDocker).toHaveBeenCalledTimes(1);
      expect(mocks.readFile).toHaveBeenCalledTimes(usePreset ? 1 : 0);
      expect(mocks.info).toHaveBeenCalledWith("TXT_CODE_e5ba712d", "test server", "test-instance");
      const logs = JSON.stringify([...mocks.info.mock.calls, ...mocks.error.mock.calls]);
      for (const secret of ["rcon-secret", "environment-secret", "command-secret"])
        expect(logs).not.toContain(secret);
      expect(mocks.error).not.toHaveBeenCalled();
    }
  );
});
