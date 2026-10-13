import { Button } from "../components/Button";
import { clamp } from "../lib/math";
import { ConfigSection } from "../components/ConfigSection";
import { ServoTrack } from "../components/ServoTrack";
import { DEFAULT_SERVO_RANGES, type Range, SERVO_NAMES } from "../servos";
import { useStatus } from "../status/status";
import { type Calibration, CENTER } from "./useCalibration";
import { useSetupServo } from "./useSetupServo";

const JOINT_COPY = [
  "Pitch only. Watch cable slack to the head. Stop before the head hits the neck piece. Down is toward the laptop; up is away.",
  "Yaw left and right. Stop when the cables pull taut. Do not twist until the loom binds.",
  "Lowest is forearm horizontal. Highest is upper arm horizontal. On this servo, higher angle is up.",
  "Same physical stops, inverted scale: higher angle is down. Physical lowest (forearm horizontal) is toward the high end of the bar; physical highest (upper arm horizontal) is toward the low end.",
  "Rotate until the right hand sits over the bell at the extreme. Prefer a band symmetric about 90° (hint only — stock 40–130 is fine).",
];
const BODY_JOINT = 4;
const NUDGES = [-10, -5, -1, 1, 5, 10];

const percent = (angle: number) => `${(angle / 180) * 100}%`;

export function FindRanges({ calibration }: { calibration: Calibration }) {
  const { setStatus } = useStatus();
  const moveServos = useSetupServo();
  const { joint, angles, ranges } = calibration;
  const angle = angles[joint];
  const [min, max] = ranges[joint];

  const withAngle = (value: number) =>
    angles.map((each, index) => (index === joint ? value : each));

  async function nudge(delta: number) {
    const next = clamp(angle + delta, 0, 180);

    if (next === angle) {
      return;
    }

    calibration.setAngles(withAngle(next));

    if (!(await moveServos({ index: joint, angle: next }))) {
      calibration.setAngles(withAngle(angle));
    }
  }

  function setRange(range: Range) {
    calibration.setRanges(ranges.map((each, index) => (index === joint ? range : each)));
  }

  function setLimit(bound: "min" | "max") {
    if (bound === "min" && angle >= max) {
      setStatus("Min must be less than max.", "err");

      return;
    }

    if (bound === "max" && angle <= min) {
      setStatus("Max must be greater than min.", "err");

      return;
    }

    setRange(bound === "min" ? [angle, max] : [min, angle]);
  }

  return (
    <ConfigSection title="Find safe ranges">
      <p className="setup-copy">
        Move one joint at a time with the buttons. Stop before cables pull taut or parts collide.
        The bar is a guide only. Stock limits are pre-filled. Switching tabs leaves the other joints
        where they are.
      </p>
      <div className="joint-tabs">
        {SERVO_NAMES.map((name, index) => (
          <Button
            key={name}
            className={index === joint ? "active" : undefined}
            aria-pressed={index === joint}
            onClick={() => calibration.setJoint(index)}
          >
            {name}
          </Button>
        ))}
      </div>
      <p className="setup-copy">{JOINT_COPY[joint]}</p>
      <p className="hint" hidden={joint !== BODY_JOINT}>
        {`Distance below 90°: ${CENTER - min}° · above 90°: ${max - CENTER}°`}
      </p>
      <div className="form-group">
        <div className="calib-angle-readout">
          <span data-testid="calib-angle">{angle}</span>°
        </div>
        <div className="calib-guide" aria-hidden="true">
          <ServoTrack
            scale={[0, 90, 180]}
            background={
              <>
                <div
                  className="servo-safe-band"
                  style={{ left: percent(min), width: percent(max - min) }}
                ></div>
                <div className="calib-marker" style={{ left: percent(angle) }}></div>
              </>
            }
          />
        </div>
      </div>
      <div className="calib-nudge">
        {NUDGES.map((delta) => (
          <Button key={delta} onClick={() => nudge(delta)}>
            {delta < 0 ? `−${-delta}°` : `+${delta}°`}
          </Button>
        ))}
      </div>
      <div className="calib-minmax">
        <Button onClick={() => setLimit("min")}>{`Set min (${min}°)`}</Button>
        <Button onClick={() => setLimit("max")}>{`Set max (${max}°)`}</Button>
      </div>
      <Button onClick={() => setRange(DEFAULT_SERVO_RANGES[joint])}>Reset to default</Button>
    </ConfigSection>
  );
}
