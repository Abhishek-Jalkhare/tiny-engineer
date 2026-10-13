#include <Arduino.h>

#include "animation.h"
#include "http/handlers.h"
#include "http/response.h"

void handleAnimGet(WebServer& server) {
  JsonDocument body;
  body["ok"] = true;
  body["animation"] = animationName(getAnimation());
  sendJson(server, 200, body);
}

void handleAnimPost(WebServer& server) {
  if (!server.hasArg("name")) {
    sendError(server, 400, "missing name");
    return;
  }

  AnimationId id;

  if (!parseAnimationName(server.arg("name").c_str(), id)) {
    sendError(server, 400, "unknown animation");
    return;
  }

  setAnimation(id);
  handleAnimGet(server);
}
