import type { ReactElement, ReactNode } from "react";
import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { captureTvFocus, restoreTvFocus, type FocusSnapshot } from "../lib/tvFocus";
import { navigationStep } from "../lib/tvKeyRepeat";

type Props = {
  title: string;
  children: ReactNode;
  onClose: () => void;
  className?: string;
};

/**
 * Generieke TV-modal met DPAD focus-trap: pijltjes blijven binnen de modal,
 * Escape/Back sluit, en de vorige focuspositie wordt hersteld bij sluiten.
 * De hardware Back-knop op Android wordt centraal in App.tsx afgehandeld.
 */
export default function TvModal(props: Props): ReactElement {
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const snapshot = useRef<FocusSnapshot>(null);
  const closeRef = useRef(props.onClose);
  const lastCategoryRow = useRef<HTMLElement | null>(null);
  closeRef.current = props.onClose;

  useEffect(() => {
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    snapshot.current = captureTvFocus();

    const panel = panelRef.current;
    const firstFocusable = panel?.querySelector<HTMLElement>(
      "input:not([disabled]):not([tabindex='-1']), button:not([disabled]), [tabindex]:not([tabindex='-1'])"
    );
    firstFocusable?.focus();

    const onKeyDown = (event: KeyboardEvent): void => {
      const key = event.key;
      const activeElement = document.activeElement;
      const isEditingText = activeElement instanceof HTMLInputElement && !activeElement.readOnly;
      if (key === "Escape" || key === "GoBack" || key === "BrowserBack") {
        if (isEditingText) {
          // Eerst editing/toetsenbord sluiten (afgehandeld door TvTextInput); volgende Back sluit de modal.
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        closeRef.current();
        return;
      }
      if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(key)) {
        return;
      }
      const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      if (active?.classList.contains("tv-programme-detail") && (key === "ArrowUp" || key === "ArrowDown")) {
        const canScroll = key === "ArrowDown" ? active.scrollTop + active.clientHeight < active.scrollHeight - 2 : active.scrollTop > 0;
        if (canScroll) { event.preventDefault(); event.stopPropagation(); active.scrollTop += key === "ArrowDown" ? 100 : -100; return; }
      }
      // In tekstvelden blijven links/rechts voor de cursor.
      if (active instanceof HTMLInputElement && (key === "ArrowLeft" || key === "ArrowRight")) {
        event.stopPropagation();
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      if (!panel) {
        return;
      }
      const categoryManager = panel.querySelector(".category-manager");
      if (categoryManager && key === "ArrowRight" && active?.closest(".category-tools")) {
        const sibling = active.nextElementSibling;
        const origin = active.getBoundingClientRect();
        if (sibling instanceof HTMLButtonElement && !sibling.disabled && Math.abs(sibling.getBoundingClientRect().top - origin.top) < 3) {
          sibling.focus(); return;
        }
        const row = lastCategoryRow.current?.isConnected ? lastCategoryRow.current : categoryManager.querySelector<HTMLElement>(".category-manager-row");
        const destination = row ?? categoryManager.querySelector<HTMLElement>(".category-browser [tabindex='0'], .category-tabs button");
        destination?.focus(); destination?.scrollIntoView({ block: "nearest" }); return;
      }
      if (categoryManager && active?.classList.contains("category-manager-row")) {
        lastCategoryRow.current = active;
        if (key === "ArrowUp" || key === "ArrowDown") {
          let next = active;
          const down = key === "ArrowDown";
          for (let i = 0, steps = navigationStep(event); i < steps; i++) {
            const sibling = down ? next.nextElementSibling : next.previousElementSibling;
            if (!(sibling instanceof HTMLElement)) break;
            next = sibling;
          }
          if (next === active) next = categoryManager.querySelector<HTMLElement>(down ? ".category-save button" : ".category-tabs button") ?? active;
          next.focus(); next.scrollIntoView({ block: "nearest" }); return;
        }
        if (key === "ArrowLeft") {
          categoryManager.querySelector<HTMLElement>(".category-bulk button:not([disabled])")?.focus(); return;
        }
        return;
      }
      const focusables = Array.from(
        panel.querySelectorAll<HTMLElement>(
          "input:not([disabled]):not([tabindex='-1']), button:not([disabled]), [tabindex]:not([tabindex='-1'])"
        )
      ).filter((item) => {
        const rect = item.getBoundingClientRect();
        const list = categoryManager && item.closest(".category-manager-list")?.getBoundingClientRect();
        if (list && (rect.bottom <= list.top || rect.top >= list.bottom)) return false;
        return rect.width > 0 && rect.height > 0;
      });
      if (focusables.length === 0) {
        return;
      }
      const index = active ? focusables.indexOf(active) : -1;
      if (index === -1) {
        focusables[0].focus();
        return;
      }
      const delta = key === "ArrowUp" || key === "ArrowLeft" ? -1 : 1;
      let next = focusables[Math.min(focusables.length - 1, Math.max(0, index + delta))];
      if (categoryManager && active) {
        const origin = active.getBoundingClientRect();
        const horizontal = key === "ArrowLeft" || key === "ArrowRight";
        const ox = origin.x + origin.width / 2, oy = origin.y + origin.height / 2;
        const targets = focusables.filter((item) => item !== active).map((item) => {
          const r = item.getBoundingClientRect();
          const dx = r.x + r.width / 2 - ox, dy = r.y + r.height / 2 - oy;
          return { item, forward: (horizontal ? dx : dy) * delta, side: Math.abs(horizontal ? dy : dx) };
        }).filter((item) => item.forward > 3).sort((a, b) => (a.forward + a.side * 3) - (b.forward + b.side * 3));
        next = targets[0]?.item ?? active;
      }
      next.focus();
      next.scrollIntoView({ block: "nearest" });
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      requestAnimationFrame(() => {
        if (snapshot.current) restoreTvFocus(snapshot.current);
        else if (previousFocusRef.current?.isConnected) previousFocusRef.current.focus();
      });
    };
  }, []);

  return (
    <div className="tv-modal-overlay" role="dialog" aria-modal="true" aria-label={props.title}>
      <div className={`tv-modal ${props.className ?? ""}`} ref={panelRef}>
        <header className="tv-modal-header">
          <h2>{props.title}</h2>
          <button className="tv-modal-close" onClick={props.onClose} aria-label="Sluiten">
            <X size={18} />
          </button>
        </header>
        <div className="tv-modal-body">{props.children}</div>
      </div>
    </div>
  );
}
