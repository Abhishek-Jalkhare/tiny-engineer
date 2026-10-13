#include <Arduino.h>

#include "animation.h"
#include "audio/audio.h"
#include "display/oled.h"
#include "hardware/pca9685_servos.h"
#include "hardware/rgb.h"
#include "http/handlers.h"
#include "http/request.h"
#include "http/response.h"
#include "servos.h"

namespace {

JsonDocument testReply(const char* test) {
  JsonDocument reply;
  reply["ok"] = true;
  reply["test"] = test;
  return reply;
}

// Every test leaves the OLED on its idle screen before it answers.
void finishTest(WebServer& server, const JsonDocument& reply) {
  showIdleScreen();
  sendJson(server, 200, reply);
}

}  // namespace

void handleAudioTest(WebServer& server) {
  runSoundTest();
  finishTest(server, testReply("audio"));
}

void handleBellTest(WebServer& server) {
  if (!playBell()) {
    showIdleScreen();
    sendError(server, 500, "bell playback failed");
    return;
  }

  finishTest(server, testReply("bell"));
}

void handleScreenTest(WebServer& server) {
  runOledTest();
  finishTest(server, testReply("screen"));
}

void handleMovementTest(WebServer& server) {
  runServoTest();
  finishTest(server, testReply("movement"));
}

void handleLedTest(WebServer& server) {
  runRgbTest();
  setRgbForAnimation(getAnimation(), millis());
  finishTest(server, testReply("led"));
}

void handleServoTest(WebServer& server) {
  JsonDocument request;

  if (!readJsonBody(server, request)) {
    return;
  }

  const std::optional<ServoMove> move = ServoMove::read(server, request.as<JsonObjectConst>());

  if (!move) {
    return;
  }

  moveServoSmooth(move->index, move->angle);

  JsonDocument reply = testReply("servo");
  move->addTo(reply);
  finishTest(server, reply);
}
