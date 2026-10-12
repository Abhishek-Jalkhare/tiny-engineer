import { apiPutJson } from "./api.js";
import { $, element } from "./dom.js";
import { setStatus } from "./status.js";

export const MAX_NETWORKS = 5;
const ssidField = $("#wifi-network-ssid");
const passwordField = $("#wifi-network-password");

function networkRow(
  ssid,
  { note = "", action, label, enabled = true, removed = false, danger = false },
) {
  const row = element("li", removed ? "wifi-network wifi-network-removed" : "wifi-network");
  const button = element("button", danger ? "btn btn-danger" : "btn", label);

  button.type = "button";
  button.disabled = !enabled;
  button.addEventListener("click", () => {
    action();
    wifiNetworks.render();
  });
  row.append(
    element("span", "wifi-network-ssid", ssid),
    element("span", "wifi-network-note", note),
    button,
  );

  return row;
}

// Adds and removals wait here until the config form is saved.
export const wifiNetworks = {
  list: $("#wifi-network-list"),
  saved: [],
  removed: new Set(),
  added: new Map(),

  load(settings) {
    this.saved = settings.wifi_networks ?? [];
    this.removed.clear();
    this.added.clear();
    this.render();
  },

  get pending() {
    return this.removed.size > 0 || this.added.size > 0;
  },

  // Order is boot priority for networks a scan misses: new ones first, then the kept saved ones.
  get desired() {
    return [
      ...[...this.added].map(([ssid, password]) => ({ ssid, password })),
      ...this.saved
        .filter((ssid) => !this.removed.has(ssid) && !this.added.has(ssid))
        .map((ssid) => ({ ssid })),
    ];
  },

  // The setup wizard's list: the network to test first, then the saved ones that still fit.
  withFirst(ssid, password) {
    return [
      { ssid, password },
      ...this.saved.filter((saved) => saved !== ssid).map((saved) => ({ ssid: saved })),
    ].slice(0, MAX_NETWORKS);
  },

  stageAdd() {
    const ssid = ssidField.value.trim();

    if (!ssid) {
      setStatus("Enter a WiFi network name.", "err");

      return;
    }

    const { desired } = this;

    if (!desired.some((network) => network.ssid === ssid) && desired.length >= MAX_NETWORKS) {
      setStatus(`The robot keeps up to ${MAX_NETWORKS} networks. Remove one first.`, "err");

      return;
    }

    this.removed.delete(ssid);
    this.added.set(ssid, passwordField.value);
    ssidField.value = "";
    passwordField.value = "";
    this.render();
  },

  // The firmware keeps its last network; factory reset is the way to clear WiFi.
  render() {
    const removable = this.desired.length > 1;
    const addedRows = [...this.added.keys()].map((ssid) =>
      networkRow(ssid, {
        note: this.saved.includes(ssid) ? "New password on save" : "Added on save",
        action: () => this.added.delete(ssid),
        label: "Undo",
      }),
    );
    const savedRows = this.saved
      .filter((ssid) => !this.added.has(ssid))
      .map((ssid) =>
        this.removed.has(ssid)
          ? networkRow(ssid, {
              note: "Removed on save",
              action: () => this.removed.delete(ssid),
              label: "Undo",
              removed: true,
            })
          : networkRow(ssid, {
              action: () => this.removed.add(ssid),
              label: "Remove",
              enabled: removable,
              danger: true,
            }),
      );

    this.list.replaceChildren(...addedRows, ...savedRows);
  },

  // Resolves to the robot's error, or null when the list saved or nothing changed.
  async save() {
    if (!this.pending) {
      return null;
    }

    const result = await apiPutJson("/settings/wifi", this.desired).catch(() => ({
      ok: false,
      data: {},
    }));

    if (!result.ok) {
      return result.data.error || "network error";
    }

    this.load(result.data);

    return null;
  },
};

$("#wifi-network-add").addEventListener("click", () => wifiNetworks.stageAdd());

for (const field of [ssidField, passwordField]) {
  field.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      wifiNetworks.stageAdd();
    }
  });
}
