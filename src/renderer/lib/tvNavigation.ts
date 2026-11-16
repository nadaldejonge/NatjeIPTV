import { handleTvDirection, rememberTvFocus } from "./tvFocus";
import { resetNavigationRepeat } from "./tvKeyRepeat";

const focusableSelector = [
  "button:not([disabled])",
  "input:not([disabled]):not([tabindex='-1'])",
  "select:not([disabled])",
  "summary",
  "[tabindex]:not([tabindex='-1'])"
].join(",");

export function installTvNavigation(): () => void {
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.defaultPrevented) {
      return;
    }

    const key = event.key;
    if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter", "Escape"].includes(key)) {
      return;
    }

    const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (key.startsWith("Arrow") && handleTvDirection(key, active)) {
      event.preventDefault();
      return;
    }
    if ((key === "Enter" || key === "Escape") && active) {
      return;
    }

    const next = nextFocusable(key, active);
    if (!next) {
      return;
    }

    event.preventDefault();
    next.focus({ preventScroll: false });
    next.scrollIntoView({ block: "nearest", inline: "nearest" });
  };

  const onFocus = (event: FocusEvent): void => { if (event.target instanceof HTMLElement) rememberTvFocus(event.target); };
  window.addEventListener("focusin", onFocus);
  window.addEventListener("keyup", resetNavigationRepeat);
  window.addEventListener("blur", resetNavigationRepeat);
  const suppressRepeatedSelect = (event: KeyboardEvent): void => {
    if (event.key === "Enter" && event.repeat && document.querySelector(".tv-shell")) { event.preventDefault(); event.stopPropagation(); }
  };
  window.addEventListener("keydown", suppressRepeatedSelect, true);
  window.addEventListener("keydown", onKeyDown);
  const initialTimer = window.setTimeout(() => {
    if (!(document.activeElement instanceof HTMLElement) || document.activeElement === document.body) {
      firstFocusable()?.focus();
    }
  }, 100);

  return () => { window.removeEventListener("keydown", onKeyDown); window.removeEventListener("keydown", suppressRepeatedSelect, true); window.removeEventListener("focusin", onFocus); window.removeEventListener("keyup", resetNavigationRepeat); window.removeEventListener("blur", resetNavigationRepeat); window.clearTimeout(initialTimer); };
}

function firstFocusable(): HTMLElement | null {
  return focusables()[0] ?? null;
}

function nextFocusable(key: string, active: HTMLElement | null): HTMLElement | null {
  const items = focusables();
  if (items.length === 0) {
    return null;
  }
  if (!active || !items.includes(active)) {
    return items[0];
  }

  const current = active.getBoundingClientRect();
  const currentCenter = center(current);
  const candidates = items.filter((item) => item !== active).map((item) => ({ item, rect: item.getBoundingClientRect() }));
  const directional = candidates
    .filter(({ rect }) => isInDirection(key, currentCenter, center(rect)))
    .sort((a, b) => score(key, currentCenter, center(a.rect)) - score(key, currentCenter, center(b.rect)));

  return directional[0]?.item ?? linearFallback(key, items, active);
}

function focusables(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(focusableSelector)).filter((item) => {
    const rect = item.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && !item.hasAttribute("disabled") && item.getAttribute("aria-hidden") !== "true";
  });
}

function center(rect: DOMRect): { x: number; y: number } {
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2
  };
}

function isInDirection(key: string, current: { x: number; y: number }, candidate: { x: number; y: number }): boolean {
  if (key === "ArrowUp") {
    return candidate.y < current.y - 4;
  }
  if (key === "ArrowDown") {
    return candidate.y > current.y + 4;
  }
  if (key === "ArrowLeft") {
    return candidate.x < current.x - 4;
  }
  if (key === "ArrowRight") {
    return candidate.x > current.x + 4;
  }
  return false;
}

function score(key: string, current: { x: number; y: number }, candidate: { x: number; y: number }): number {
  const dx = candidate.x - current.x;
  const dy = candidate.y - current.y;
  const primary = key === "ArrowLeft" || key === "ArrowRight" ? Math.abs(dx) : Math.abs(dy);
  const secondary = key === "ArrowLeft" || key === "ArrowRight" ? Math.abs(dy) : Math.abs(dx);
  return primary * 3 + secondary;
}

function linearFallback(key: string, items: HTMLElement[], active: HTMLElement): HTMLElement | null {
  const index = items.indexOf(active);
  if (key === "ArrowUp" || key === "ArrowLeft") {
    return items[Math.max(0, index - 1)] ?? null;
  }
  if (key === "ArrowDown" || key === "ArrowRight") {
    return items[Math.min(items.length - 1, index + 1)] ?? null;
  }
  return null;
}
