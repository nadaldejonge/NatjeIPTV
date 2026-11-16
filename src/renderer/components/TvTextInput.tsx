import type { ReactElement } from "react";
import { useRef, useState } from "react";
import { Pencil } from "lucide-react";

type Props = {
  value: string;
  placeholder?: string;
  type?: "text" | "password";
  disabled?: boolean;
  name?: string;
  enterKeyHint?: "search" | "done" | "next";
  onChange: (value: string) => void;
  onSubmit?: (value: string) => void;
};

/**
 * TV-tekstveld met gescheiden toestanden FOCUSED en EDITING.
 *
 * - DPAD-focus op de wrapper toont alleen een focusring; het veld is readOnly
 *   en niet-focusbaar, dus het Android TV-toetsenbord opent NIET.
 * - OK/Enter start editing: het veld wordt bewerkbaar, krijgt focus en pas dan
 *   opent het toetsenbord.
 * - Back/Escape (of blur) verlaat editing; de focus blijft op de wrapper zodat
 *   een volgende Back de omliggende modal sluit.
 */
export default function TvTextInput(props: Props): ReactElement {
  const [editing, setEditing] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function startEditing(): void {
    if (props.disabled) {
      return;
    }
    setEditing(true);
    window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(props.value.length, props.value.length);
    }, 0);
  }

  function stopEditing(returnFocus: boolean): void {
    setEditing(false);
    inputRef.current?.blur();
    if (returnFocus) {
      window.setTimeout(() => wrapperRef.current?.focus(), 0);
    }
  }

  return (
    <div
      ref={wrapperRef}
      className={editing ? "tv-text-input editing" : "tv-text-input"}
      tabIndex={props.disabled || editing ? -1 : 0}
      role="button"
      aria-label={props.placeholder}
      onKeyDown={(event) => {
        if (!editing && event.key === "Enter") {
          event.preventDefault();
          event.stopPropagation();
          startEditing();
        }
      }}
      onClick={() => {
        if (!editing) {
          startEditing();
        }
      }}
    >
      <input
        ref={inputRef}
        value={props.value}
        type={props.type ?? "text"}
        placeholder={props.placeholder}
        name={props.name}
        enterKeyHint={props.enterKeyHint}
        disabled={props.disabled}
        readOnly={!editing}
        tabIndex={editing ? 0 : -1}
        onChange={(event) => props.onChange(event.target.value)}
        onCompositionEnd={(event) => {
          if (event.currentTarget.value !== props.value) props.onChange(event.currentTarget.value);
        }}
        onBlur={(event) => {
          // IME commits can arrive without React's final change event. Save the
          // visible text before ending editing can restore the controlled value.
          if (event.currentTarget.value !== props.value) props.onChange(event.currentTarget.value);
          // Android TV kan tijdens het openen van het software keyboard kort focus
          // uit de WebView halen. Alleen een bewuste focusovergang naar een ander
          // bedieningselement sluit editing; tijdelijk focusverlies naar de IME niet.
          if (event.relatedTarget instanceof HTMLElement && !wrapperRef.current?.contains(event.relatedTarget)) stopEditing(false);
        }}
        onKeyDown={(event) => {
          if (!editing) {
            return;
          }
          if (event.key === "Enter") {
            event.preventDefault();
            event.stopPropagation();
            const value = event.currentTarget.value;
            if (value !== props.value) props.onChange(value);
            stopEditing(true);
            props.onSubmit?.(value);
            return;
          }
          if (event.key === "Escape" || event.key === "GoBack" || event.key === "BrowserBack") {
            event.preventDefault();
            event.stopPropagation();
            stopEditing(true);
          }
        }}
      />
      {!editing && <Pencil size={14} className="tv-text-input-icon" aria-hidden="true" />}
    </div>
  );
}
