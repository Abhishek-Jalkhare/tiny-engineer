import { useRobot } from "../robot";

export function Footer() {
  const { version } = useRobot();

  return (
    <footer>
      <a href="https://github.com/jamro/tiny-engineer" target="_blank" rel="noopener">
        github.com/jamro/tiny-engineer
      </a>
      <p id="fw-version">{version ? `Firmware ${version}` : "Firmware …"}</p>
    </footer>
  );
}
