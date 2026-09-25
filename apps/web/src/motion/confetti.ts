/**
 * Confetti for a win (spec §6.3). The library loads only when someone wins. It never asks the OS about motion:
 * confetti is a peak, and peaks run only while the in-game Animations switch is on (spec 2026-09-25-table-layout §6.1).
 */
export async function celebrate(): Promise<void> {
  const { default: confetti } = await import('canvas-confetti');
  const burst = { spread: 70, startVelocity: 55, zIndex: 60 };
  void confetti({ ...burst, particleCount: 80, angle: 60, origin: { x: 0.05, y: 0.75 } });
  void confetti({ ...burst, particleCount: 80, angle: 120, origin: { x: 0.95, y: 0.75 } });
  setTimeout(() => void confetti({ ...burst, particleCount: 120, spread: 110, origin: { x: 0.5, y: 0.45 } }), 350);
}
