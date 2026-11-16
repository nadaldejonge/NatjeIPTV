let heldKey = "";
let heldSince = 0;
let fractionalRows = 0;

/** Native keyboard repeat drives movement; no background timer can keep scrolling after release. */
export function navigationStep(event: KeyboardEvent, now = performance.now()): number {
  if (!event.repeat || heldKey !== event.key) { heldKey = event.key; heldSince = now; fractionalRows = 0; }
  const heldSeconds = Math.max(0, now - heldSince) / 1000;
  // Continuous acceleration curve, rather than fixed speed tiers at two/four seconds.
  // Fractional distance carries across repeats so the ramp remains smooth at integer rows.
  const rows = Math.min(12, 1 + Math.pow(heldSeconds, 1.6)) + fractionalRows;
  const step = Math.min(12, Math.floor(rows));
  fractionalRows = rows - Math.floor(rows);
  return step;
}

export function resetNavigationRepeat(): void { heldKey = ""; heldSince = 0; fractionalRows = 0; }
