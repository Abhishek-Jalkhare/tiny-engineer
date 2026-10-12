#include "http/settings_handlers.h"

#include <Arduino.h>
#include <ArduinoJson.h>
#include <cstdlib>
#include <cstdio>
#include <cstring>

#include "display/oled.h"
#include "http/json.h"
#include "http/server_context.h"
#include "network/wifi_connect.h"
#include "settings/settings.h"
#include "settings/wifi_network_list.h"

namespace {

bool parseServoCsv(const String& raw, uint8_t out[SETTINGS_SERVO_COUNT]) {
  const char* p = raw.c_str();

  for (size_t i = 0; i < SETTINGS_SERVO_COUNT; i++) {
    if (p == nullptr || *p == '\0') {
      return false;
    }

    char* end = nullptr;
    const unsigned long parsed = strtoul(p, &end, 10);

    if (end == p || parsed > 255) {
      return false;
    }

    if (i + 1 < SETTINGS_SERVO_COUNT) {
      if (*end != ',') {
        return false;
      }

      p = end + 1;
    } else if (*end != '\0') {
      return false;
    }

    out[i] = static_cast<uint8_t>(parsed);
  }

  return true;
}

void sendSettingsJson(
  WebServer& server,
  bool rebootRequired,
  bool wifiConnectSuccess
) {
  JsonDocument doc;

  doc["ok"] = true;
  doc["sleep_timeout"] = settingsSleepTimeoutMin();
  doc["hostname"] = settingsHostname();
  doc["volume"] = settingsVolume();
  doc["welcome"] = settingsWelcomeEnabled();
  doc["serial_log"] = settingsSerialLogEnabled();
  doc["continuous_timeout"] = settingsContinuousTimeoutMin();
  doc["loading"] = settingsLoading();
  doc["eyes_style"] = settingsEyesStyle();
  doc["access_token_set"] = settingsAccessTokenSet();
  doc["wifi_configured"] = settingsWifiConfigured();

  JsonArray servoMins = doc["servo_mins"].to<JsonArray>();
  JsonArray servoMaxs = doc["servo_maxs"].to<JsonArray>();

  for (size_t i = 0; i < SETTINGS_SERVO_COUNT; i++) {
    servoMins.add(static_cast<unsigned>(settingsServoMin(i)));
    servoMaxs.add(static_cast<unsigned>(settingsServoMax(i)));
  }

  doc["rgb_order"] = settingsRgbOrder();
  doc["oled_rotate_180"] = settingsOledRotate180();

  const WifiNetworkList& networks = settingsWifiNetworks();
  JsonArray ssids = doc["wifi_networks"].to<JsonArray>();

  for (size_t i = 0; i < networks.count(); i++) {
    ssids.add(networks.at(i).ssid);
  }

  if (wifiConnectSuccess) {
    doc["wifi_connect_success"] = true;
    doc["wifi_ip"] = wifiIpText();
    doc["wifi_hostname"] = httpMdnsHostname();
  }

  if (rebootRequired) {
    doc["reboot_required"] = true;
  }

  String body;
  body.reserve(measureJson(doc));
  serializeJson(doc, body);
  httpSendJson(server, 200, body.c_str());
}

}  // namespace

void handleSettingsGet(WebServer& server) {
  sendSettingsJson(server, false, false);
}

void handleSettingsPost(WebServer& server) {
  const bool hasSleep = server.hasArg("sleep_timeout");
  const bool hasHost = server.hasArg("hostname");
  const bool hasVolume = server.hasArg("volume");
  const bool hasWelcome = server.hasArg("welcome");
  const bool hasSerialLog = server.hasArg("serial_log");
  const bool hasContTo = server.hasArg("continuous_timeout");
  const bool hasLoading = server.hasArg("loading");
  const bool hasEyesStyle = server.hasArg("eyes_style");
  const bool hasAccessToken = server.hasArg("access_token");
  const bool hasServoMins = server.hasArg("servo_mins");
  const bool hasServoMaxs = server.hasArg("servo_maxs");
  const bool hasRgbOrder = server.hasArg("rgb_order");
  const bool hasOledRotate180 = server.hasArg("oled_rotate_180");

  if (!hasSleep && !hasHost && !hasVolume && !hasWelcome && !hasSerialLog &&
      !hasContTo && !hasLoading && !hasEyesStyle && !hasAccessToken &&
      !hasServoMins && !hasServoMaxs &&
      !hasRgbOrder && !hasOledRotate180) {
    httpSendJson(
      server,
      400,
      "{\"ok\":false,\"error\":\"missing sleep_timeout, hostname, volume, welcome, serial_log, continuous_timeout, loading, eyes_style, access_token, servo_mins, servo_maxs, rgb_order, or oled_rotate_180\"}"
    );
    return;
  }

  uint32_t sleepTimeoutMin = 0;
  const uint32_t* sleepPtr = nullptr;
  String hostnameArg;
  const char* hostPtr = nullptr;
  uint8_t volume = 0;
  const uint8_t* volumePtr = nullptr;
  bool welcome = false;
  const bool* welcomePtr = nullptr;
  bool serialLog = false;
  const bool* serialLogPtr = nullptr;
  uint32_t continuousTimeoutMin = 0;
  const uint32_t* contToPtr = nullptr;
  String loadingArg;
  const char* loadingPtr = nullptr;
  String eyesStyleArg;
  const char* eyesStylePtr = nullptr;
  String accessTokenArg;
  const char* accessTokenPtr = nullptr;
  uint8_t servoMins[SETTINGS_SERVO_COUNT] = {};
  uint8_t servoMaxs[SETTINGS_SERVO_COUNT] = {};
  const uint8_t* servoMinsPtr = nullptr;
  const uint8_t* servoMaxsPtr = nullptr;
  String rgbOrderArg;
  const char* rgbOrderPtr = nullptr;
  bool oledRotate180 = false;
  const bool* oledRotate180Ptr = nullptr;

  if (hasSleep) {
    const String sleepArg = server.arg("sleep_timeout");
    char* end = nullptr;
    const unsigned long parsed =
      strtoul(sleepArg.c_str(), &end, 10);

    if (end == sleepArg.c_str() || *end != '\0') {
      httpSendJson(
        server,
        400,
        "{\"ok\":false,\"error\":\"invalid sleep_timeout\"}"
      );
      return;
    }

    sleepTimeoutMin = static_cast<uint32_t>(parsed);

    if (!settingsValidateSleepTimeout(sleepTimeoutMin)) {
      httpSendJson(
        server,
        400,
        "{\"ok\":false,\"error\":\"sleep_timeout out of range\"}"
      );
      return;
    }

    sleepPtr = &sleepTimeoutMin;
  }

  if (hasHost) {
    hostnameArg = server.arg("hostname");
    hostPtr = hostnameArg.c_str();

    if (!settingsValidateHostname(hostPtr)) {
      httpSendJson(
        server,
        400,
        "{\"ok\":false,\"error\":\"invalid hostname\"}"
      );
      return;
    }
  }

  if (hasVolume) {
    const String volumeArg = server.arg("volume");
    char* end = nullptr;
    const unsigned long parsed =
      strtoul(volumeArg.c_str(), &end, 10);

    if (end == volumeArg.c_str() || *end != '\0' || parsed > 255) {
      httpSendJson(
        server,
        400,
        "{\"ok\":false,\"error\":\"invalid volume\"}"
      );
      return;
    }

    volume = static_cast<uint8_t>(parsed);

    if (!settingsValidateVolume(volume)) {
      httpSendJson(
        server,
        400,
        "{\"ok\":false,\"error\":\"volume out of range\"}"
      );
      return;
    }

    volumePtr = &volume;
  }

  if (hasWelcome) {
    const String welcomeArg = server.arg("welcome");
    char* end = nullptr;
    const unsigned long parsed =
      strtoul(welcomeArg.c_str(), &end, 10);

    if (end == welcomeArg.c_str() || *end != '\0' || parsed > 1) {
      httpSendJson(
        server,
        400,
        "{\"ok\":false,\"error\":\"invalid welcome\"}"
      );
      return;
    }

    welcome = parsed == 1;
    welcomePtr = &welcome;
  }

  if (hasSerialLog) {
    const String serialLogArg = server.arg("serial_log");
    char* end = nullptr;
    const unsigned long parsed =
      strtoul(serialLogArg.c_str(), &end, 10);

    if (end == serialLogArg.c_str() || *end != '\0' || parsed > 1) {
      httpSendJson(
        server,
        400,
        "{\"ok\":false,\"error\":\"invalid serial_log\"}"
      );
      return;
    }

    serialLog = parsed == 1;
    serialLogPtr = &serialLog;
  }

  if (hasContTo) {
    const String contArg = server.arg("continuous_timeout");
    char* end = nullptr;
    const unsigned long parsed =
      strtoul(contArg.c_str(), &end, 10);

    if (end == contArg.c_str() || *end != '\0') {
      httpSendJson(
        server,
        400,
        "{\"ok\":false,\"error\":\"invalid continuous_timeout\"}"
      );
      return;
    }

    continuousTimeoutMin = static_cast<uint32_t>(parsed);

    if (!settingsValidateContinuousTimeout(continuousTimeoutMin)) {
      httpSendJson(
        server,
        400,
        "{\"ok\":false,\"error\":\"continuous_timeout out of range\"}"
      );
      return;
    }

    contToPtr = &continuousTimeoutMin;
  }

  if (hasLoading) {
    loadingArg = server.arg("loading");
    loadingPtr = loadingArg.c_str();

    if (!settingsValidateLoading(loadingPtr)) {
      httpSendJson(
        server,
        400,
        "{\"ok\":false,\"error\":\"invalid loading\"}"
      );
      return;
    }
  }

  if (hasEyesStyle) {
    eyesStyleArg = server.arg("eyes_style");
    eyesStylePtr = eyesStyleArg.c_str();

    if (!settingsValidateEyesStyle(eyesStylePtr)) {
      httpSendJson(
        server,
        400,
        "{\"ok\":false,\"error\":\"invalid eyes_style\"}"
      );
      return;
    }
  }

  if (hasAccessToken) {
    accessTokenArg = server.arg("access_token");
    accessTokenPtr = accessTokenArg.c_str();

    if (!settingsValidateAccessToken(accessTokenPtr)) {
      httpSendJson(
        server,
        400,
        "{\"ok\":false,\"error\":\"invalid access_token\"}"
      );
      return;
    }
  }

  if (hasServoMins || hasServoMaxs) {
    if (!wifiProvisioningMode()) {
      httpSendJson(
        server,
        400,
        "{\"ok\":false,\"error\":\"servo setup only in AP mode\"}"
      );
      return;
    }

    if (!hasServoMins || !hasServoMaxs) {
      httpSendJson(
        server,
        400,
        "{\"ok\":false,\"error\":\"servo_mins and servo_maxs required together\"}"
      );
      return;
    }

    if (!parseServoCsv(server.arg("servo_mins"), servoMins) ||
        !parseServoCsv(server.arg("servo_maxs"), servoMaxs)) {
      httpSendJson(
        server,
        400,
        "{\"ok\":false,\"error\":\"invalid servo_mins or servo_maxs\"}"
      );
      return;
    }

    if (!settingsValidateServoRanges(servoMins, servoMaxs)) {
      httpSendJson(
        server,
        400,
        "{\"ok\":false,\"error\":\"servo ranges out of range\"}"
      );
      return;
    }

    servoMinsPtr = servoMins;
    servoMaxsPtr = servoMaxs;
  }

  if (hasRgbOrder) {
    if (!wifiProvisioningMode()) {
      httpSendJson(
        server,
        400,
        "{\"ok\":false,\"error\":\"rgb setup only in AP mode\"}"
      );
      return;
    }

    rgbOrderArg = server.arg("rgb_order");

    if (!settingsValidateRgbOrder(rgbOrderArg.c_str())) {
      httpSendJson(
        server,
        400,
        "{\"ok\":false,\"error\":\"invalid rgb_order\"}"
      );
      return;
    }

    rgbOrderPtr = rgbOrderArg.c_str();
  }

  if (hasOledRotate180) {
    if (!wifiProvisioningMode()) {
      httpSendJson(
        server,
        400,
        "{\"ok\":false,\"error\":\"oled setup only in AP mode\"}"
      );
      return;
    }

    const String oledArg = server.arg("oled_rotate_180");
    char* end = nullptr;
    const unsigned long parsed =
      strtoul(oledArg.c_str(), &end, 10);

    if (end == oledArg.c_str() || *end != '\0' || parsed > 1) {
      httpSendJson(
        server,
        400,
        "{\"ok\":false,\"error\":\"invalid oled_rotate_180\"}"
      );
      return;
    }

    oledRotate180 = parsed == 1;
    oledRotate180Ptr = &oledRotate180;
  }

  bool rebootRequired = false;

  if (!saveSettings(
        sleepPtr,
        hostPtr,
        volumePtr,
        welcomePtr,
        serialLogPtr,
        contToPtr,
        loadingPtr,
        eyesStylePtr,
        accessTokenPtr,
        servoMinsPtr,
        servoMaxsPtr,
        rgbOrderPtr,
        oledRotate180Ptr,
        &rebootRequired
      )) {
    httpSendJson(
      server,
      400,
      "{\"ok\":false,\"error\":\"save failed\"}"
    );
    return;
  }

  refreshMdnsHostname();

  if (oledRotate180Ptr != nullptr) {
    applyOledRotation();
    restoreProvisioningOled();
  }

  sendSettingsJson(server, rebootRequired, false);
}

void handleSettingsWifiPut(WebServer& server) {
  JsonDocument body;

  if (deserializeJson(body, server.arg("plain")) ||
      !body.is<JsonArrayConst>()) {
    httpSendJson(
      server,
      400,
      "{\"ok\":false,\"error\":\"body must be a JSON array of networks\"}"
    );
    return;
  }

  const JsonArrayConst entries = body.as<JsonArrayConst>();

  // An empty list would put the robot in setup AP mode at the next boot;
  // factory reset is the way to clear WiFi.
  if (entries.size() == 0) {
    httpSendJson(
      server,
      400,
      "{\"ok\":false,\"error\":\"send at least one wifi network\"}"
    );
    return;
  }

  const WifiNetworkList& saved = settingsWifiNetworks();
  WifiNetworkList next;

  for (const JsonObjectConst entry : entries) {
    const JsonVariantConst passwordField = entry["password"];
    // A missing key keeps the saved password; an explicit null is an error.
    const bool keepsPassword = passwordField.isUnbound();

    if (!entry["ssid"].is<const char*>() ||
        !(keepsPassword || passwordField.is<const char*>())) {
      httpSendJson(
        server,
        400,
        "{\"ok\":false,\"error\":\"each network needs a string ssid and an optional string password\"}"
      );
      return;
    }

    const char* ssid = entry["ssid"];
    const char* password = keepsPassword ? saved.passwordFor(ssid)
                                         : passwordField.as<const char*>();

    if (password == nullptr) {
      httpSendJson(
        server,
        400,
        "{\"ok\":false,\"error\":\"password required for a new network\"}"
      );
      return;
    }

    if (!next.add(ssid, password)) {
      httpSendJson(
        server,
        400,
        "{\"ok\":false,\"error\":\"invalid ssid or password, duplicate ssid, or more than 5 networks\"}"
      );
      return;
    }
  }

  // Outside setup AP mode a test would drop the connection serving this
  // request, so the list is saved untested.
  const bool tested = wifiProvisioningMode();

  if (tested &&
      !wifiTestCredentials(next.at(0).ssid, next.at(0).password)) {
    char error[96];
    snprintf(
      error,
      sizeof(error),
      "{\"ok\":false,\"error\":\"%s\"}",
      wifiLastConnectError()
    );
    httpSendJson(server, 400, error);
    return;
  }

  if (!saveWifiNetworks(next)) {
    if (tested) {
      wifiRestoreProvisioningAp();
    }

    httpSendJson(
      server,
      400,
      "{\"ok\":false,\"error\":\"save failed\"}"
    );
    return;
  }

  sendSettingsJson(server, false, tested);

  if (tested) {
    delay(300);
    wifiStopProvisioningAp();
    showBootIp(wifiIpText());
  }
}

void handleSettingsReset(WebServer& server) {
  bool rebootRequired = false;

  if (!factoryResetSettings(&rebootRequired)) {
    httpSendJson(
      server,
      400,
      "{\"ok\":false,\"error\":\"factory reset failed\"}"
    );
    return;
  }

  sendSettingsJson(server, rebootRequired, false);
}

bool isSettingsOrAnimPath(const String& uri) {
  return uri == "/anim" || uri == "/play" || uri.startsWith("/play/") ||
         uri == "/settings" || uri == "/settings/reset" ||
         uri == "/settings/wifi" ||
         uri == "/auth" || uri == "/setup/servo";
}
