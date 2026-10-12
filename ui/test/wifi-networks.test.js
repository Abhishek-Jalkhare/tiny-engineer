import { beforeEach, describe, expect, it } from "vitest";
import { $, click, fakeRobot, loadApp, settle, submit } from "./robot.js";

const rows = () =>
  [...document.querySelectorAll("#wifi-network-list .wifi-network")].map((row) => ({
    ssid: row.querySelector(".wifi-network-ssid").textContent,
    note: row.querySelector(".wifi-network-note").textContent,
    button: row.querySelector(".btn"),
  }));

const wifiPuts = (robot) =>
  robot.requests.filter((request) => request.method === "PUT" && request.path === "/settings/wifi");

async function stage(ssid, password = "") {
  $("#wifi-network-ssid").value = ssid;
  $("#wifi-network-password").value = password;
  await click("#wifi-network-add");
}

async function removeRow(ssid) {
  rows()
    .find((row) => row.ssid === ssid)
    .button.click();
  await settle();
}

describe("wifi networks", () => {
  beforeEach(() => sessionStorage.clear());

  it("keeps the last saved network", async () => {
    fakeRobot({ settings: { wifi_networks: ["home"] } });
    await loadApp("/config");

    expect(rows().map((row) => row.ssid)).toEqual(["home"]);
    expect(rows()[0].button.disabled).toBe(true);
  });

  it("sends the whole list once on save", async () => {
    const robot = fakeRobot({ settings: { wifi_networks: ["home"] } });

    await loadApp("/config");
    await stage(" office ", "secret");
    await removeRow("home");

    expect(rows().map((row) => row.note)).toEqual(["Added on save", "Removed on save"]);
    expect(wifiPuts(robot)).toEqual([]);

    await submit("#config-form");

    expect(wifiPuts(robot).map((request) => request.json)).toEqual([
      [{ ssid: "office", password: "secret" }],
    ]);
    expect(rows().map((row) => row.ssid)).toEqual(["office"]);
    expect($("#status").textContent).toBe("Settings saved. WiFi networks apply after reboot.");
  });

  it("swaps four of five networks in one request", async () => {
    const robot = fakeRobot({ settings: { wifi_networks: ["a", "b", "c", "d", "e"] } });

    await loadApp("/config");

    for (const ssid of ["a", "b", "c", "d"]) {
      await removeRow(ssid);
    }

    for (const ssid of ["f", "g", "h", "i"]) {
      await stage(ssid, "pw");
    }

    await submit("#config-form");

    expect(wifiPuts(robot)).toHaveLength(1);
    expect(robot.settings.wifi_networks).toEqual(["f", "g", "h", "i", "e"]);
  });

  it("keeps saved passwords by leaving them out", async () => {
    const robot = fakeRobot({ settings: { wifi_networks: ["home", "office"] } });

    await loadApp("/config");
    await removeRow("office");
    await submit("#config-form");

    expect(wifiPuts(robot)[0].json).toEqual([{ ssid: "home" }]);
  });

  it("sends nothing when the list did not change", async () => {
    const robot = fakeRobot({ settings: { wifi_networks: ["home"] } });

    await loadApp("/config");
    await stage("office");
    await click("#wifi-network-list .wifi-network:first-child .btn");
    await submit("#config-form");

    expect(wifiPuts(robot)).toEqual([]);
    expect($("#status").textContent).toBe("Settings saved.");
  });

  it("refuses a sixth network", async () => {
    fakeRobot({ settings: { wifi_networks: ["a", "b", "c", "d", "e"] } });
    await loadApp("/config");
    await stage("f");

    expect(rows()).toHaveLength(5);
    expect($("#status").textContent).toBe("The robot keeps up to 5 networks. Remove one first.");
  });

  it("keeps the controls locked until the list is saved", async () => {
    fakeRobot({ settings: { wifi_networks: ["home", "office"] } });

    await loadApp("/config");
    await removeRow("office");

    const robotFetch = globalThis.fetch;
    let saveDisabledDuringPut = null;

    globalThis.fetch = (input, options) => {
      if (options?.method === "PUT") {
        saveDisabledDuringPut = $("#config-form [type=submit]").disabled;
      }

      return robotFetch(input, options);
    };

    await submit("#config-form");

    expect(saveDisabledDuringPut).toBe(true);
    expect($("#config-form [type=submit]").disabled).toBe(false);
  });

  it("reports the robot's error", async () => {
    const robot = fakeRobot({ settings: { wifi_networks: ["home", "office"] } });

    await loadApp("/config");
    await removeRow("office");
    robot.failing.add("/settings/wifi");
    await submit("#config-form");

    expect($("#status").textContent).toBe("Settings saved. WiFi networks not saved: robot said no");
  });
});
