#include "serial_log.h"
#include "settings/nvs.h"
#include "settings/values.h"

namespace {

// True when the networks came from the single-network keys of older firmware.
bool loadWifiNetworks() {
  if (g_settingsPrefs.isKey(kKeyWifiNets)) {
    uint8_t blob[sizeof(WifiNetwork) * SETTINGS_WIFI_NETWORK_MAX] = {};
    const size_t length =
      g_settingsPrefs.getBytes(kKeyWifiNets, blob, sizeof(blob));
    g_wifiNetworks.load(blob, length);
    return false;
  }

  if (!g_settingsPrefs.isKey(kKeyWifiSsid)) {
    return false;
  }

  const String ssid = g_settingsPrefs.getString(kKeyWifiSsid, "");
  const String password = g_settingsPrefs.getString(kKeyWifiPass, "");
  g_wifiNetworks.add(ssid.c_str(), password.c_str());
  return true;
}

void migrateLegacyWifi() {
  if (!g_settingsPrefs.begin(kNs, false)) {
    return;
  }

  // An invalid legacy SSID loads as an empty list; its keys go too.
  const size_t length = g_wifiNetworks.count() * sizeof(WifiNetwork);
  const bool moved =
    length == 0 ||
    g_settingsPrefs.putBytes(kKeyWifiNets, g_wifiNetworks.data(), length) ==
      length;

  if (moved) {
    g_settingsPrefs.remove(kKeyWifiSsid);
    g_settingsPrefs.remove(kKeyWifiPass);
  }

  g_settingsPrefs.end();
}

}  // namespace

void initSettings() {
  g_settings = SettingsValues::defaults();
  g_wifiNetworks.clear();
  bool legacyWifi = false;

  if (g_settingsPrefs.begin(kNs, true)) {
    g_settings.load();
    legacyWifi = loadWifiNetworks();
    g_settingsPrefs.end();
  } else {
    serialLogPrintln("Settings: NVS open failed; using defaults");
  }

  g_bootSettings = g_settings;

  if (legacyWifi) {
    migrateLegacyWifi();
  }

  g_settings.log("Settings:");
}
