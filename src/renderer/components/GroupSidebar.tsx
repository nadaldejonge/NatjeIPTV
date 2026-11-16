import type { ReactElement } from "react";
import { memo } from "react";
import { focusTv, focusZone } from "../lib/tvFocus";
import { navigationStep } from "../lib/tvKeyRepeat";
type GroupItem = {
  name: string;
  count?: number;
  loading?: boolean;
};

type Props = {
  groups: GroupItem[];
  activeGroup: string;
  onSelectGroup: (group: string) => void;
  tvMode?: boolean;
};

function GroupSidebar({ groups, activeGroup, onSelectGroup, tvMode }: Props): ReactElement {
  return (
    <aside className="group-sidebar" data-tv-zone={tvMode ? "categories" : undefined}>
      {groups.map((group) => (
        <button
          key={group.name}
          data-focus-key={tvMode ? `category:${group.name}` : undefined}
          aria-current={group.name === activeGroup ? "true" : undefined}
          className={group.name === activeGroup ? "group-item active" : "group-item"}
          onClick={() => onSelectGroup(group.name)}
          onKeyDown={(event) => {
            if (tvMode && event.key === "ArrowRight") {
              event.preventDefault(); event.stopPropagation(); focusZone("channels"); return;
            }
            if (event.key !== "ArrowUp" && event.key !== "ArrowDown") {
              return;
            }
            const direction = event.key === "ArrowDown" ? 1 : -1;
            let next = focusSiblingGroup(event.currentTarget, direction);
            if (tvMode && next) {
              const steps = navigationStep(event.nativeEvent);
              for (let i = 1; i < steps; i++) next = focusSiblingGroup(next, direction) ?? next;
            }
            if (!next) {
              return;
            }
            event.preventDefault();
            event.stopPropagation();
            if (tvMode) focusTv(next);
            else { next.focus(); next.scrollIntoView({ block: "nearest" }); }
          }}
          title={group.name}
        >
          <span>{group.name}</span>
          {(group.loading || typeof group.count === "number") && <strong>{group.loading ? "..." : group.count}</strong>}
        </button>
      ))}
    </aside>
  );
}

export default memo(GroupSidebar);

function focusSiblingGroup(current: HTMLElement, direction: 1 | -1): HTMLElement | null {
  let sibling: Element | null = direction === 1 ? current.nextElementSibling : current.previousElementSibling;
  while (sibling) {
    if (sibling instanceof HTMLElement && sibling.matches("button.group-item:not([disabled])")) {
      return sibling;
    }
    sibling = direction === 1 ? sibling.nextElementSibling : sibling.previousElementSibling;
  }
  return null;
}
