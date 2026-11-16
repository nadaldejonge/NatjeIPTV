export type FocusSnapshot = { key: string; context: string } | null;
const memory = new Map<string, string>();
let last: FocusSnapshot = null;

export function captureTvFocus(): FocusSnapshot {
  const element = document.activeElement instanceof HTMLElement ? document.activeElement.closest<HTMLElement>("[data-focus-key]") : null;
  return element ? { key: element.dataset.focusKey!, context: element.closest<HTMLElement>("[data-focus-context]")?.dataset.focusContext ?? "" } : last;
}

export function rememberTvFocus(element: HTMLElement): void {
  const zone = element.closest<HTMLElement>("[data-tv-zone]");
  if (!element.dataset.focusKey || !zone) return;
  const context = zone.dataset.focusContext ?? "";
  memory.set(`${zone.dataset.tvZone}:${context}`, element.dataset.focusKey);
  last = { key: element.dataset.focusKey, context };
}

export function focusTv(element: HTMLElement | null): boolean {
  if (!element || !element.isConnected) return false;
  element.focus({ preventScroll: true });
  rememberTvFocus(element);
  const scroller = element.closest<HTMLElement>(".channel-list, .group-sidebar, .tv-modal-body, .tv-search-results");
  if (scroller) {
    const r = element.getBoundingClientRect();
    const box = scroller.getBoundingClientRect();
    if (r.top < box.top + 5) scroller.scrollTop += r.top - box.top - 5;
    else if (r.bottom > box.bottom - 5) scroller.scrollTop += r.bottom - box.bottom + 5;
  }
  return document.activeElement === element;
}

export function restoreTvFocus(snapshot: FocusSnapshot = last): boolean {
  if (snapshot) {
    const target = Array.from(document.querySelectorAll<HTMLElement>("[data-focus-key]")).find((el) => el.dataset.focusKey === snapshot.key && (el.closest<HTMLElement>("[data-focus-context]")?.dataset.focusContext ?? "") === snapshot.context);
    if (target && focusTv(target)) return true;
  }
  return focusZone("channels") || focusZone("categories") || focusZone("preview");
}

export function focusZone(name: string): boolean {
  const zone = document.querySelector<HTMLElement>(`[data-tv-zone="${name}"]`);
  if (!zone) return false;
  const items = Array.from(zone.querySelectorAll<HTMLElement>("[data-focus-key]:not([disabled])"));
  const key = memory.get(`${name}:${zone.dataset.focusContext ?? ""}`);
  return focusTv(items.find((el) => el.dataset.focusKey === key) ?? items.find((el) => el.getAttribute("aria-current") === "true") ?? items[0] ?? null);
}

/** Cross-zone edges only; vertical list movement stays on the existing O(1) path. */
export function handleTvDirection(key: string, active: HTMLElement | null): boolean {
  if (!document.querySelector(".tv-shell") || document.querySelector('[role="dialog"]')) return false;
  const zone = active?.closest<HTMLElement>("[data-tv-zone]")?.dataset.tvZone;
  if (!zone) return key.startsWith("Arrow") && restoreTvFocus();
  if (zone === "categories" && key === "ArrowRight") { focusZone("channels"); return true; }
  if (zone === "categories" && key === "ArrowLeft") return true;
  if (zone === "channels" && key === "ArrowLeft") { focusZone("categories"); return true; }
  if (zone === "channels" && key === "ArrowRight") { focusZone("preview"); return true; }
  if (zone === "preview") {
    if (key === "ArrowLeft") focusZone("channels") || focusZone("categories");
    if (key === "ArrowDown") focusZone("actions");
    if (key === "ArrowUp") focusZone("toolbar");
    return true;
  }
  if (zone === "actions" || zone === "toolbar") {
    const parent = active!.closest<HTMLElement>("[data-tv-zone]")!;
    const items = Array.from(parent.querySelectorAll<HTMLElement>("button:not([disabled])"));
    const index = items.indexOf(active!);
    if (key === "ArrowLeft" || key === "ArrowRight") {
      if (key === "ArrowLeft" && index <= 0 && zone === "actions") focusZone("channels");
      else focusTv(items[Math.max(0, Math.min(items.length - 1, index + (key === "ArrowRight" ? 1 : -1)))]);
    } else if (key === "ArrowUp" && zone === "actions") focusZone("preview");
    else if (key === "ArrowDown" && zone === "toolbar") focusZone("channels") || focusZone("categories");
    return true;
  }
  if (key === "ArrowUp") { focusZone("toolbar"); return true; }
  if (key === "ArrowDown") return true;
  return false;
}
