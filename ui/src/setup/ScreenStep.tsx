import { useEffect } from "preact/hooks";
import { sendQuietly } from "../api/client";
import { Button } from "../components/Button";
import { ConfigSection } from "../components/ConfigSection";

// No body restores the setup screen.
const previewOled = (json?: { rotate_180: boolean }) =>
  sendQuietly("/setup/oled", { method: "POST", json });

// The OLED shows the orientation test while this step is open.
export function ScreenStep({ rotate180, onRotate }: { rotate180: boolean; onRotate: () => void }) {
  useEffect(() => {
    void previewOled({ rotate_180: rotate180 });
  }, [rotate180]);

  useEffect(() => () => void previewOled(), []);

  return (
    <ConfigSection title="Screen">
      <p className="setup-copy">
        Look at the OLED. Text should read right-side up. Tap Rotate 180° if it is upside down.
      </p>
      <Button variant="primary" onClick={onRotate}>
        Rotate 180°
      </Button>
    </ConfigSection>
  );
}
