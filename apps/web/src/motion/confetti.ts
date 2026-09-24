/** Confetti for a win (spec §6.3). The library loads only when someone wins, and skips itself under reduced motion. */
export async function celebrate(): Promise<void> {
  const { default: confetti } = await import('canvas-confetti');
  const burst = { spread: 70, startVelocity: 55, zIndex: 60, disableForReducedMotion: true };
  void confetti({ ...burst, particleCount: 80, angle: 60, origin: { x: 0.05, y: 0.75 } });
  void confetti({ ...burst, particleCount: 80, angle: 120, origin: { x: 0.95, y: 0.75 } });
  setTimeout(() => void confetti({ ...burst, particleCount: 120, spread: 110, origin: { x: 0.5, y: 0.45 } }), 350);
}
