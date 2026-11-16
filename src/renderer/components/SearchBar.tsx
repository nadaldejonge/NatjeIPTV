import type { ReactElement } from "react";
import { Filter, Loader2, Search } from "lucide-react";

type Props = {
  value: string;
  total: number;
  isLoading: boolean;
  scopeLabel: string;
  countries: string[];
  hiddenCountries: string[];
  onChange: (value: string) => void;
  onSearch: () => void;
  onToggleCountry: (country: string) => void;
};

export default function SearchBar({
  value,
  total,
  isLoading,
  scopeLabel,
  countries,
  hiddenCountries,
  onChange,
  onSearch,
  onToggleCountry
}: Props): ReactElement {
  return (
    <div className="search-row">
      <label className="search-box">
        <Search size={18} />
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              onSearch();
            }
          }}
          placeholder={`Zoek ${scopeLabel}`}
          enterKeyHint="search"
        />
      </label>
      <button className="search-action" onClick={() => onSearch()} disabled={!value.trim()}>
        {isLoading ? <Loader2 className="spin" size={17} /> : <Search size={17} />}
        Zoeken
      </button>
      {countries.length > 0 && (
        <details className="country-filter">
          <summary title="Landen filteren" aria-label="Landen filteren">
            <Filter size={17} />
            <span>Landen</span>
            {hiddenCountries.length > 0 && <strong>{hiddenCountries.length}</strong>}
          </summary>
          <div className="country-menu">
            {countries.map((country) => {
              const enabled = !hiddenCountries.includes(country);
              return (
                <label key={country}>
                  <input type="checkbox" checked={enabled} onChange={() => onToggleCountry(country)} />
                  <span className="country-flag">{flagForCountry(country)}</span>
                  <span>{country}</span>
                </label>
              );
            })}
          </div>
        </details>
      )}
      <div className="counter">{total} zichtbaar</div>
    </div>
  );
}

function flagForCountry(country: string): string {
  if (!/^[A-Z]{2}$/.test(country)) {
    return "??";
  }

  return String.fromCodePoint(...country.split("").map((letter) => 127397 + letter.charCodeAt(0)));
}
