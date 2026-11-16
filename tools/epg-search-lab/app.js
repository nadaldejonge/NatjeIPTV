const storageKey = "natje-epg-hidden-countries";

const state = {
  countries: [],
  hiddenCountries: new Set(JSON.parse(localStorage.getItem(storageKey) || "[]")),
  source: null,
  results: new Map(),
  processed: 0,
  total: 0,
  matches: 0
};

window.addEventListener("beforeunload", () => {
  if (state.source) {
    state.source.close();
  }
});

const els = {
  serverState: document.querySelector("#serverState"),
  queryInput: document.querySelector("#queryInput"),
  searchButton: document.querySelector("#searchButton"),
  stopButton: document.querySelector("#stopButton"),
  clearCacheButton: document.querySelector("#clearCacheButton"),
  scopeText: document.querySelector("#scopeText"),
  countryGrid: document.querySelector("#countryGrid"),
  progressRing: document.querySelector("#progressRing"),
  progressPercent: document.querySelector("#progressPercent"),
  progressTitle: document.querySelector("#progressTitle"),
  progressDetail: document.querySelector("#progressDetail"),
  processedStat: document.querySelector("#processedStat"),
  matchStat: document.querySelector("#matchStat"),
  cacheStat: document.querySelector("#cacheStat"),
  results: document.querySelector("#results"),
  resultCount: document.querySelector("#resultCount"),
  resultHint: document.querySelector("#resultHint"),
  enableAllButton: document.querySelector("#enableAllButton"),
  disableAllButton: document.querySelector("#disableAllButton")
};

bootstrap();

els.searchButton.addEventListener("click", startSearch);
els.stopButton.addEventListener("click", stopSearch);
els.queryInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    startSearch();
  }
});

els.enableAllButton.addEventListener("click", () => {
  state.hiddenCountries.clear();
  persistCountries();
  renderCountries();
});

els.disableAllButton.addEventListener("click", () => {
  state.hiddenCountries = new Set(state.countries.map((country) => country.code));
  persistCountries();
  renderCountries();
});

els.clearCacheButton.addEventListener("click", async () => {
  els.clearCacheButton.disabled = true;
  try {
    const response = await fetch("/api/cache/clear", { method: "POST" });
    const data = await response.json();
    els.cacheStat.textContent = String(data.cache?.epgItems ?? 0);
    setStatus("Cache geleegd", "Nieuwe zoekactie haalt verse EPG op.");
  } catch (error) {
    setStatus("Cache legen mislukt", error instanceof Error ? error.message : "Onbekende fout");
  } finally {
    els.clearCacheButton.disabled = false;
  }
});

async function bootstrap() {
  try {
    const response = await fetch("/api/bootstrap");
    const data = await response.json();
    if (!data.ok) {
      throw new Error(data.error || "Bootstrap mislukt");
    }

    state.countries = data.countries ?? [];
    els.serverState.textContent = `${data.account} actief`;
    els.serverState.classList.add("ready");
    els.cacheStat.textContent = String(data.cache?.epgItems ?? 0);
    renderCountries();
    updateScopeText(data.liveCategoryCount);
    renderEmpty("Typ een zoekterm en scan actuele info. Per zender gebruikt hij max 3 programma's terug en 3 vooruit.");
  } catch (error) {
    els.serverState.textContent = "Niet verbonden";
    els.serverState.classList.add("error");
    setStatus("Kon niet starten", error instanceof Error ? error.message : "Check je .env en server.");
  }
}

function startSearch() {
  const query = els.queryInput.value.trim();
  if (query.length < 2) {
    setStatus("Te kort", "Typ minimaal 2 tekens.");
    return;
  }

  stopSearch();
  state.results.clear();
  state.processed = 0;
  state.total = 0;
  state.matches = 0;
  renderResults();
  setProgress(0);
  setStatus("Zoeken gestart", "Categorieen en zenders voorbereiden...");
  setBusy(true);

  const params = new URLSearchParams({
    q: query,
    hidden: Array.from(state.hiddenCountries).join(",")
  });
  state.source = new EventSource(`/api/search-stream?${params.toString()}`);

  state.source.addEventListener("open", () => {
    setStatus("Verbonden", "Zoekstream is gestart...");
  });

  state.source.addEventListener("heartbeat", () => {
    if (state.source) {
      els.serverState.textContent = "Scan actief";
      els.serverState.classList.add("ready");
    }
  });

  state.source.addEventListener("scope", (event) => {
    const data = JSON.parse(event.data);
    els.progressDetail.textContent = `${data.categoryCount}/${data.totalCategoryCount} categorieen actief`;
  });

  state.source.addEventListener("categoryProgress", (event) => {
    const data = JSON.parse(event.data);
    els.progressTitle.textContent = "Zenderlijsten laden";
    els.progressDetail.textContent = `${data.loaded}/${data.total} categorieen, ${data.channels} zenders gevonden`;
  });

  state.source.addEventListener("status", (event) => {
    const data = JSON.parse(event.data);
    els.progressTitle.textContent = data.message;
  });

  state.source.addEventListener("match", (event) => {
    const data = JSON.parse(event.data);
    state.results.set(data.channel.streamId, data);
    state.matches = state.results.size;
    renderResults();
  });

  state.source.addEventListener("progress", (event) => {
    const data = JSON.parse(event.data);
    state.processed = data.processed;
    state.total = data.total;
    state.matches = data.matches;
    updateStats(data);
    setProgress(data.total > 0 ? data.processed / data.total : 0);
    els.progressTitle.textContent = "Programma-info scannen";
    els.progressDetail.textContent = `${data.processed}/${data.total} zenders bekeken`;
  });

  state.source.addEventListener("done", (event) => {
    const data = JSON.parse(event.data);
    updateStats(data);
    setProgress(1);
    setStatus("Klaar", `${data.matches} matches uit ${data.processed} zenders, ${data.errors + (data.categoryErrors ?? 0)} errors overgeslagen`);
    stopSearch(false);
  });

  state.source.addEventListener("scanError", (event) => {
    let message = "Scanfout.";
    try {
      message = JSON.parse(event.data).message ?? message;
    } catch {
      // Ignore malformed payload.
    }
    setStatus("Fout", message);
    stopSearch(false);
  });

  state.source.addEventListener("error", () => {
    if (!state.source) {
      return;
    }

    const alreadyStarted = state.processed > 0 || state.total > 0 || state.results.size > 0;
    setStatus(alreadyStarted ? "Verbinding gestopt" : "Zoeken start niet", "De lokale scanstream is weggevallen. Probeer opnieuw.");
    stopSearch(false);
  });
}

function stopSearch(markStopped = true) {
  if (state.source) {
    state.source.close();
    state.source = null;
  }
  setBusy(false);
  if (markStopped && state.processed > 0) {
    setStatus("Gestopt", `${state.processed}/${state.total} zenders bekeken`);
  }
}

function renderCountries() {
  els.countryGrid.replaceChildren(
    ...state.countries.map((country) => {
      const enabled = !state.hiddenCountries.has(country.code);
      const label = document.createElement("label");
      label.className = `country-chip${enabled ? "" : " off"}`;
      label.title = enabled ? `${country.code} wordt gescand` : `${country.code} staat uit`;

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = enabled;
      checkbox.addEventListener("change", () => {
        if (checkbox.checked) {
          state.hiddenCountries.delete(country.code);
        } else {
          state.hiddenCountries.add(country.code);
        }
        persistCountries();
        renderCountries();
      });

      const flag = document.createElement("span");
      flag.textContent = flagForCountry(country.code);

      const text = document.createElement("span");
      text.textContent = `${country.code} (${country.count})`;

      label.append(checkbox, flag, text);
      return label;
    })
  );
  updateScopeText();
}

function renderResults() {
  els.resultCount.textContent = String(state.results.size);
  els.matchStat.textContent = String(state.results.size);

  if (state.results.size === 0) {
    renderEmpty("Nog geen matches.");
    return;
  }

  els.results.replaceChildren(
    ...Array.from(state.results.values()).map((result) => {
      const card = document.createElement("article");
      card.className = "result-card";

      const header = document.createElement("header");
      const logo = document.createElement("div");
      logo.className = "logo";
      if (result.channel.logo) {
        const img = document.createElement("img");
        img.src = result.channel.logo;
        img.alt = "";
        img.loading = "lazy";
        img.onerror = () => {
          logo.replaceChildren(initials(result.channel.name));
        };
        logo.append(img);
      } else {
        logo.append(initials(result.channel.name));
      }

      const nameWrap = document.createElement("div");
      const channelName = document.createElement("div");
      channelName.className = "channel-name";
      channelName.textContent = result.channel.name;
      const group = document.createElement("div");
      group.className = "programme-time";
      group.textContent = result.channel.group;
      nameWrap.append(channelName, group);

      const pill = document.createElement("span");
      pill.className = "match-pill";
      pill.textContent = result.matchedOn;
      header.append(logo, nameWrap, pill);

      const title = document.createElement("div");
      title.className = "programme-title";
      title.textContent = result.programme?.title || "Geen titel meegeleverd";

      const description = document.createElement("div");
      description.className = "programme-description";
      description.textContent = result.programme?.description || "Geen beschrijving meegeleverd.";

      const footer = document.createElement("footer");
      const time = document.createElement("span");
      time.textContent = formatProgrammeTime(result.programme);
      const stream = document.createElement("span");
      stream.textContent = `#${result.channel.streamId}`;
      footer.append(time, stream);

      card.append(header, title, description, footer);
      return card;
    })
  );
}

function renderEmpty(text) {
  const empty = document.createElement("div");
  empty.className = "empty-state";
  empty.textContent = text;
  els.results.replaceChildren(empty);
}

function updateStats(data) {
  els.processedStat.textContent = String(data.processed ?? state.processed);
  els.matchStat.textContent = String(data.matches ?? state.matches);
  els.cacheStat.textContent = String(data.cachedEpgItems ?? data.cache?.epgItems ?? els.cacheStat.textContent);
}

function updateScopeText(totalCategories) {
  const active = state.countries.filter((country) => !state.hiddenCountries.has(country.code)).length;
  const hidden = state.hiddenCountries.size;
  const total = totalCategories ? `${totalCategories} live categorieen` : `${state.countries.length} landen`;
  els.scopeText.textContent = `${active}/${state.countries.length} landen actief, ${hidden} uitgeschakeld, ${total}`;
}

function setBusy(isBusy) {
  els.searchButton.disabled = isBusy;
  els.stopButton.disabled = !isBusy;
  els.queryInput.disabled = isBusy;
}

function setStatus(title, detail) {
  els.progressTitle.textContent = title;
  els.progressDetail.textContent = detail;
  els.resultHint.textContent = detail;
}

function setProgress(value) {
  const clamped = Math.max(0, Math.min(1, value));
  els.progressRing.style.setProperty("--progress", `${Math.round(clamped * 360)}deg`);
  els.progressPercent.textContent = `${Math.round(clamped * 100)}%`;
}

function persistCountries() {
  localStorage.setItem(storageKey, JSON.stringify(Array.from(state.hiddenCountries)));
}

function flagForCountry(country) {
  if (!/^[A-Z]{2}$/.test(country)) {
    return "--";
  }
  return String.fromCodePoint(...country.split("").map((letter) => 127397 + letter.charCodeAt(0)));
}

function initials(name) {
  const span = document.createElement("span");
  span.textContent = String(name || "?").trim().slice(0, 2).toUpperCase();
  return span;
}

function formatProgrammeTime(programme) {
  if (!programme?.start && !programme?.end) {
    return "Geen tijd meegeleverd";
  }
  return [programme.start, programme.end].filter(Boolean).join(" - ");
}
