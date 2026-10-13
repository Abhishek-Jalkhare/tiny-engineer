import { Button } from "../components/Button";
import { ConfigSection } from "../components/ConfigSection";
import { useStatus } from "../status/status";

export function SpeakerStep() {
  const { perform } = useStatus();

  async function play() {
    await perform({
      path: "/setup/audio",
      pending: "Playing…",
      failure: "Playback failed",
      done: "Done.",
    });
  }

  return (
    <ConfigSection title="Speaker">
      <p className="setup-copy">
        Play the welcome clip. You should hear speech from the speaker. Skip if you want — you can
        test again later from Tests.
      </p>
      <Button id="setup-audio-play" variant="primary" onClick={play}>
        Play
      </Button>
    </ConfigSection>
  );
}
