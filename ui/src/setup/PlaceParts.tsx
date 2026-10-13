import { Button } from "../components/Button";
import { ConfigSection } from "../components/ConfigSection";
import { SERVO_NAMES } from "../servos";
import { type Calibration, CENTER } from "./useCalibration";
import { useSetupServo } from "./useSetupServo";

export function PlaceParts({ calibration }: { calibration: Calibration }) {
  const moveServos = useSetupServo();

  async function centerAll() {
    if (await moveServos({ all: CENTER })) {
      calibration.setAngles(SERVO_NAMES.map(() => CENTER));
    }
  }

  return (
    <ConfigSection title="Attach the printed parts">
      <p className="setup-copy">
        All joints use the full 0–180° electrical scale. <strong>90°</strong> is shaft center, not
        the middle of the safe band.
      </p>
      <p className="setup-copy">
        Press each printed part onto the servo shaft at rest: head toward the laptop, neck straight,
        hands down, body centered in the chair. Snug the shaft screws.
      </p>
      <Button id="setup-move-90" variant="primary" onClick={centerAll}>
        Move all to 90°
      </Button>
      <Button id="setup-horns-done" onClick={calibration.placePartsDone}>
        Parts are on →
      </Button>
    </ConfigSection>
  );
}
