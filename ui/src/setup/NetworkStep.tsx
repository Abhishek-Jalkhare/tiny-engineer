import type { TargetedSubmitEvent } from "preact";
import { useState } from "preact/hooks";
import type { Settings, WifiNetwork } from "../api/types";
import { Button } from "../components/Button";
import { ConfigSection } from "../components/ConfigSection";
import { HostnameField } from "../components/HostnameField";
import { MAX_NETWORKS } from "../config/useWifiNetworks";
import { useRobot } from "../robot";
import { useStatus } from "../status/status";
import { useResettableState } from "../useResettableState";

// The network to test first, then the saved ones that still fit.
const withFirst = (saved: string[], ssid: string, password: string): WifiNetwork[] =>
  [
    { ssid, password },
    ...saved.filter((name) => name !== ssid).map((name) => ({ ssid: name })),
  ].slice(0, MAX_NETWORKS);

export function NetworkStep({ settings }: { settings: Settings }) {
  const { applySettings, leaveSetup } = useRobot();
  const { perform, setStatus } = useStatus();
  const [ssid, setSsid] = useState("");
  const [password, setPassword] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [hostname, setHostname] = useResettableState(settings.hostname, String);

  // Runs once the browser has checked the hostname field.
  async function connect(event: TargetedSubmitEvent<HTMLFormElement>) {
    event.preventDefault();

    const network = ssid.trim();

    if (!network) {
      setStatus("Enter a WiFi network name.", "err");

      return;
    }

    // The connection test registers mDNS under the saved hostname, so it is saved first.
    const hostnameSaved = await perform({
      path: "/settings",
      request: { method: "POST", json: { hostname } },
      pending: "Saving hostname…",
      failure: "Hostname not saved",
    });

    if (!hostnameSaved?.ok) {
      return;
    }

    const result = await perform<Settings>({
      path: "/settings/wifi",
      request: { method: "PUT", json: withFirst(settings.wifi_networks, network, password) },
      pending: "Testing WiFi credentials…",
      failure: "WiFi connection failed",
    });

    if (!result?.ok) {
      return;
    }

    applySettings(result.data);

    const { wifi_connect_success: connected, wifi_ip: ip, wifi_hostname: mdns } = result.data;

    if (!connected) {
      setStatus("WiFi connection failed", "err");

      return;
    }

    setPassword("");
    leaveSetup();

    const links = [ip, mdns].filter(Boolean).map((host) => `http://${host}`);

    setStatus(
      links.length
        ? `WiFi connected. Rejoin your home network and open ${links.join(" or ")}.`
        : "WiFi connected. Rejoin your home network.",
      "ok",
    );
  }

  return (
    <ConfigSection title="WiFi" apply="now">
      <p className="hint">
        Enter the network name and password for the WiFi you want the robot to join.
      </p>
      <form onSubmit={connect}>
        <div className="form-group">
          <label htmlFor="config-wifi-ssid">Network name (SSID)</label>
          <input
            type="text"
            id="config-wifi-ssid"
            autoFocus
            maxLength={32}
            autoComplete="off"
            value={ssid}
            onInput={(event) => setSsid(event.currentTarget.value)}
          />
        </div>
        <div className="form-group">
          <label htmlFor="config-wifi-password">Password</label>
          <div className="token-row">
            <input
              type={revealed ? "text" : "password"}
              id="config-wifi-password"
              maxLength={63}
              autoComplete="new-password"
              value={password}
              onInput={(event) => setPassword(event.currentTarget.value)}
            />
            <Button
              className="btn-token-toggle"
              aria-pressed={revealed}
              onClick={() => setRevealed(!revealed)}
            >
              {revealed ? "Hide" : "Show"}
            </Button>
          </div>
          <p className="hint">Leave empty only for open networks.</p>
        </div>
        <HostnameField id="config-wifi-hostname" value={hostname} onInput={setHostname} />
        <Button type="submit" id="config-wifi-connect" variant="primary">
          Connect to WiFi
        </Button>
      </form>
    </ConfigSection>
  );
}
