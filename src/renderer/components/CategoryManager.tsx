import { useMemo, useState } from "react";
import type { CategoryPreferences } from "../../shared/settings";
import { type CategoryEntry, matchesSearch, moveCategories, orderCategories } from "../lib/categoryPreferences";
import TvModal from "./TvModal";
import TvTextInput from "./TvTextInput";

type Props = {
  categories: CategoryEntry[];
  preferences: CategoryPreferences;
  sectionLabel: string;
  tvMode?: boolean;
  onSave: (preferences: CategoryPreferences) => Promise<void>;
  onClose: () => void;
};

export default function CategoryManager(props: Props) {
  const [draft, setDraft] = useState(props.preferences);
  const [selected, setSelected] = useState(new Set<string>());
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"all" | "visible" | "hidden">("all");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const hidden = useMemo(() => new Set(draft.hidden), [draft.hidden]);
  const ordered = useMemo(() => orderCategories(props.categories, draft.order), [props.categories, draft.order]);
  const rows = ordered.filter((item) => matchesSearch(item.name, "", query) &&
    (tab === "all" || (tab === "hidden" ? hidden.has(item.key) : !hidden.has(item.key))));
  const toggle = (key: string) => setSelected((current) => { const next = new Set(current); if (next.has(key)) next.delete(key); else next.add(key); return next; });
  const changeVisibility = (hide: boolean) => {
    const next = new Set(draft.hidden);
    const shown = new Set(draft.shown ?? []);
    for (const key of selected) { if (hide) { next.add(key); shown.delete(key); } else { next.delete(key); shown.add(key); } }
    setDraft({ ...draft, hidden: [...next], shown: [...shown] }); setSelected(new Set());
  };
  const move = (direction: "up" | "down" | "top" | "bottom") => setDraft({ ...draft,
    order: [...moveCategories(ordered.map((item) => item.key), selected, direction), ...draft.order.filter((key) => !props.categories.some((item) => item.key === key))]
  });

  return <TvModal className="category-dialog" title={`Categorieën beheren · ${props.sectionLabel}`} onClose={() => { if (!saving) props.onClose(); }}>
    <div className="category-manager" aria-busy={saving}>
      <div className="category-manager-main">
      <aside className="category-tools">
        <p className="tv-modal-hint">Selecteer categorieën in de lijst.</p>
        <span role="status" className="category-selection-count">{selected.size} geselecteerd</span>
        <div className="category-actions category-visibility-reset">
          <button disabled={saving || props.categories.length === 0} onClick={() => { setDraft({ ...draft, hidden: [...new Set([...draft.hidden, ...props.categories.map((item) => item.key)])], shown: [] }); setSelected(new Set()); setTab("hidden"); setQuery(""); }}>Alles uit</button>
          <button disabled={saving} onClick={() => { setDraft({ ...draft, hidden: [], shown: props.categories.map((item) => item.key) }); setSelected(new Set()); setTab("all"); }}>Alles aan</button>
        </div>
        <div className="category-actions category-bulk">
          <button disabled={saving || rows.length === 0} onClick={() => setSelected(new Set(rows.map((item) => item.key)))}>Selecteer getoonde</button>
          <button disabled={saving || selected.size === 0} onClick={() => setSelected(new Set())}>Deselecteren</button>
          <button disabled={saving || selected.size === 0} onClick={() => changeVisibility(true)}>Verberg selectie</button>
          <button disabled={saving || selected.size === 0} onClick={() => changeVisibility(false)}>Toon selectie</button>
        </div>
        <p className="category-tools-label">Volgorde aanpassen</p>
        <div className="category-actions category-move" aria-label="Selectie verplaatsen">
          <button aria-label="Helemaal bovenaan" disabled={saving || selected.size === 0} onClick={() => move("top")}>Bovenaan</button>
          <button disabled={saving || selected.size === 0} onClick={() => move("up")}>Omhoog</button>
          <button aria-label="Helemaal onderaan" disabled={saving || selected.size === 0} onClick={() => move("bottom")}>Onderaan</button>
          <button disabled={saving || selected.size === 0} onClick={() => move("down")}>Omlaag</button>
        </div>
        <p className="category-help">Terughalen: kies Verborgen, selecteer categorieën en kies Toon selectie.</p>
        <p className="category-help">Toon selectie zet ook categorieën uit een uitgezet land aan. Je keuzes worden per onderdeel opgeslagen.</p>
      </aside>
      <div className="category-browser">
      {props.tvMode ? <TvTextInput value={query} onChange={setQuery} placeholder="Categorie zoeken…" /> :
        <input aria-label="Categorie zoeken" placeholder="Categorie zoeken…" value={query} onChange={(event) => setQuery(event.target.value)} />}
      <div className="category-tabs">
        {([['all', 'Alle'], ['visible', 'Zichtbaar'], ['hidden', 'Verborgen']] as const).map(([value, label]) =>
          <button key={value} aria-pressed={tab === value} onClick={() => { setTab(value); setSelected(new Set()); }}>{label}</button>)}
        <span>{rows.length} categorieën</span>
      </div>
      <div className="category-manager-list" aria-label="Categorieën selecteren">
        {rows.map((item) => <button key={item.key} className="category-manager-row" data-category-key={item.key} aria-pressed={selected.has(item.key)} disabled={saving} onClick={() => toggle(item.key)}>
          <span className="category-check" aria-hidden="true">{selected.has(item.key) ? "✓" : ""}</span>
          <span dir="auto">{item.name}</span>
          <em>{hidden.has(item.key) ? "Verborgen" : item.countryHidden && !draft.shown?.includes(item.key) ? "Landenfilter uit" : "Zichtbaar"}</em>
        </button>)}
        {rows.length === 0 && <p className="tv-modal-hint">Geen categorieën in deze weergave.</p>}
      </div>
      </div>
      </div>
      {error && <p role="alert">{error}</p>}
      <div className="category-actions category-save">
        <button disabled={saving} onClick={async () => { setSaving(true); setError(""); try { await props.onSave(draft); props.onClose(); } catch { setError("Opslaan mislukt. Je selectie blijft bewaard; probeer opnieuw."); setSaving(false); } }}>{saving ? "Opslaan…" : "Opslaan"}</button>
        <button disabled={saving} onClick={props.onClose}>Annuleren</button>
        <button disabled={saving} onClick={() => { setDraft({ hidden: [], order: [] }); setSelected(new Set()); }}>Herstel standaard</button>
      </div>
    </div>
  </TvModal>;
}
