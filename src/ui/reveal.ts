/**
 * The hand-over from the welcome view to the dashboard: the upload button flies from where it
 * was (`from`, measured before the switch) to its place in the header, and `parts` fade in one
 * after another. Nothing moves when the system asks for reduced motion.
 */
export function revealDashboard(
  from: DOMRect,
  button: HTMLElement,
  parts: readonly Element[],
): void {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const to = button.getBoundingClientRect();
  if (from.width && to.width) {
    const dx = from.left - to.left;
    const dy = from.top - to.top;
    button.style.transformOrigin = '0 0';
    button.animate(
      [
        {
          transform: `translate(${String(dx)}px,${String(dy)}px) scale(${String(from.width / to.width)},${String(from.height / to.height)})`,
        },
        { transform: 'none' },
      ],
      { duration: 700, easing: 'cubic-bezier(.2,.75,.15,1)' },
    );
  }
  parts.forEach((part, k) => {
    part.animate(
      [
        { opacity: 0, transform: 'translateY(16px)' },
        { opacity: 1, transform: 'none' },
      ],
      {
        duration: 520,
        delay: 120 + Math.min(k, 8) * 45,
        easing: 'cubic-bezier(.2,.7,.2,1)',
        fill: 'backwards',
      },
    );
  });
}
