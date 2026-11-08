// ============================================================
// UI
// ============================================================

// Choices for "Show top N" (0 means all), the default, and where the choice is remembered
const TOP_K_OPTIONS = [5, 10, 25, 50, 0];
const DEFAULT_TOP_K = 10;
const TOP_K_KEY = "topK";

// UI state
let ui = null;              // references to the panel's elements
let currentResults = null;  // { ranked, savedAt, ... } once we have results
let activeTab = "majors";   // "majors" or "minors"
let topK = DEFAULT_TOP_K;   // how many rows to show per tab (0 = all)
let searchQuery = "";       // text typed in the search box (filters by program name)
let running = false;        // true while ranking, to ignore double clicks

// Makes text safe to put inside HTML (program names come from the server)
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = String(text);
  return div.innerHTML;
}

// "just now", "5 min ago", "3 hr ago", "2 days ago"
function timeAgo(timestamp) {
  const minutes = Math.round((Date.now() - timestamp) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

const STYLES = `
  :host { all: initial; }
  * { box-sizing: border-box; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; }

  .fab {
    position: fixed; right: 20px; bottom: 20px; z-index: 2147483647;
    background: #232D4B; color: #fff; border: none; border-radius: 999px;
    padding: 12px 18px; font-size: 14px; font-weight: 600; cursor: pointer;
    box-shadow: 0 4px 14px rgba(0,0,0,.25);
  }
  .fab:hover { background: #2f3c63; }

  .panel {
    position: fixed; right: 20px; bottom: 72px; z-index: 2147483647;
    width: min(400px, calc(100vw - 32px)); max-height: min(640px, calc(100vh - 100px));
    display: flex; flex-direction: column;
    background: #fff; color: #1d2433; border-radius: 12px;
    box-shadow: 0 10px 40px rgba(0,0,0,.25); overflow: hidden;
  }
  .panel[hidden] { display: none; }

  .header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 14px 16px; background: #232D4B; color: #fff;
  }
  .title { font-size: 15px; font-weight: 700; }
  .icon-btn {
    background: none; border: none; color: inherit; cursor: pointer;
    font-size: 18px; line-height: 1; padding: 4px 6px; border-radius: 6px;
  }
  .icon-btn:hover { background: rgba(255,255,255,.15); }

  .status { padding: 10px 16px 0; font-size: 12px; color: #5b6475; }
  .progress { height: 4px; margin: 8px 16px 0; background: #e8ebf1; border-radius: 2px; overflow: hidden; }
  .progress[hidden] { display: none; }
  .progress span { display: block; height: 100%; width: 0; background: #E57200; transition: width .2s; }

  .tabs { display: flex; gap: 6px; padding: 12px 16px 8px; }
  .tab {
    flex: 1; padding: 8px; border: 1px solid #d6dbe4; background: #fff; color: #1d2433;
    border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer;
  }
  .tab.active { background: #232D4B; border-color: #232D4B; color: #fff; }

  .list { list-style: none; margin: 0; padding: 0 16px; overflow-y: auto; flex: 1; }
  .row { border-bottom: 1px solid #eef0f4; }
  .row-link {
    display: flex; align-items: center; gap: 12px; padding: 12px 8px; margin: 0 -8px;
    color: inherit; text-decoration: none; border-radius: 8px;
  }
  a.row-link:hover { background: #f4f6fa; }
  a.row-link:hover .name { color: #E57200; }
  .rank { width: 22px; font-size: 12px; color: #8a92a3; text-align: right; flex-shrink: 0; }
  .row-main { flex: 1; min-width: 0; }
  .name { font-size: 14px; font-weight: 600; }
  .meta { font-size: 12px; color: #6b7385; margin-top: 2px; }
  .bar { height: 6px; background: #e8ebf1; border-radius: 3px; margin-top: 6px; overflow: hidden; }
  .bar span { display: block; height: 100%; background: #232D4B; }
  .left { text-align: right; flex-shrink: 0; }
  .left b { display: block; font-size: 18px; color: #E57200; }
  .left small { font-size: 11px; color: #6b7385; }
  .done {
    font-size: 12px; font-weight: 700; color: #1a7f37; background: #e6f4ea;
    padding: 4px 8px; border-radius: 999px;
  }
  .controls {
    display: flex; align-items: center; gap: 8px;
    padding: 0 16px 8px; font-size: 12px; color: #5b6475;
  }
  .search {
    flex: 1; min-width: 0; font-size: 13px; padding: 6px 10px;
    border: 1px solid #d6dbe4; border-radius: 6px; color: #1d2433; background: #fff;
  }
  .search:focus { outline: none; border-color: #232D4B; box-shadow: 0 0 0 2px rgba(35,45,75,.15); }
  .top-k-label { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
  .controls select {
    font-size: 12px; padding: 4px 6px; border: 1px solid #d6dbe4; border-radius: 6px;
    background: #fff; color: #1d2433; cursor: pointer;
  }
  .empty { padding: 24px 0; text-align: center; font-size: 13px; color: #6b7385; }

  .footer { display: flex; gap: 8px; padding: 12px 16px; border-top: 1px solid #eef0f4; }
  .btn {
    flex: 1; padding: 9px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer;
    border: 1px solid #d6dbe4; background: #fff; color: #1d2433;
  }
  .btn:hover:not(:disabled) { background: #f4f6fa; }
  .btn:disabled { opacity: .5; cursor: default; }
  .btn[hidden] { display: none; }
`;

// Builds the floating button and the (initially hidden) panel.
// Everything lives in a shadow root so Stellic's CSS can't affect it, and ours can't affect Stellic.
function createUI() {
  const host = document.createElement("div");
  host.id = "stellic-ranker";
  document.body.appendChild(host);
  const root = host.attachShadow({ mode: "open" });

  root.innerHTML = `
    <style>${STYLES}</style>
    <button class="fab">Rank programs</button>
    <div class="panel" hidden>
      <div class="header">
        <span class="title">Closest majors & minors</span>
        <button class="icon-btn close" aria-label="Close">✕</button>
      </div>
      <div class="status"></div>
      <div class="progress" hidden><span></span></div>
      <div class="tabs">
        <button class="tab active" data-tab="majors">Second majors</button>
        <button class="tab" data-tab="minors">Minors</button>
      </div>
      <div class="controls">
        <input class="search" type="search" placeholder="Search programs…" aria-label="Search programs">
        <label class="top-k-label">
          Show top
          <select class="top-k">
            ${TOP_K_OPTIONS.map(n => `<option value="${n}">${n === 0 ? "All" : n}</option>`).join("")}
          </select>
        </label>
      </div>
      <ul class="list"></ul>
      <div class="footer">
        <button class="btn rerank">Re-rank</button>
      </div>
    </div>
  `;

  ui = {
    fab: root.querySelector(".fab"),
    panel: root.querySelector(".panel"),
    close: root.querySelector(".close"),
    status: root.querySelector(".status"),
    progress: root.querySelector(".progress"),
    progressFill: root.querySelector(".progress span"),
    tabs: root.querySelectorAll(".tab"),
    list: root.querySelector(".list"),
    topK: root.querySelector(".top-k"),
    search: root.querySelector(".search"),
    rerank: root.querySelector(".rerank"),
  };

  // Floating button: open/close the panel; the first open starts the ranker
  ui.fab.addEventListener("click", () => {
    ui.panel.hidden = !ui.panel.hidden;
    if (!ui.panel.hidden && !currentResults && !running) startRanking();
  });

  ui.close.addEventListener("click", () => { ui.panel.hidden = true; });

  ui.tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      activeTab = tab.dataset.tab;
      ui.tabs.forEach(t => t.classList.toggle("active", t === tab));
      renderList();
    });
  });

  // Search box: filters the list as you type (works across both tabs)
  ui.search.addEventListener("input", () => {
    searchQuery = ui.search.value.trim().toLowerCase();
    renderList();
  });

  // Stop Stellic's own keyboard shortcuts from firing while typing in the search box
  ui.search.addEventListener("keydown", e => e.stopPropagation());

  // "Show top N" picker: re-render right away and remember the choice for next time
  ui.topK.value = String(topK);
  ui.topK.addEventListener("change", () => {
    topK = Number(ui.topK.value);
    renderList();
    try {
      chrome.storage.local.set({ [TOP_K_KEY]: topK }).catch(() => {});
    } catch (err) {
      if (extensionWasUpdated(err)) setStatus(UPDATED_MESSAGE);
    }
  });

  // Load the remembered choice (if any) from last time
  chrome.storage.local.get(TOP_K_KEY).then(stored => {
    if (TOP_K_OPTIONS.includes(stored[TOP_K_KEY])) {
      topK = stored[TOP_K_KEY];
      ui.topK.value = String(topK);
      renderList();
    }
  }).catch(() => {});

  ui.rerank.addEventListener("click", () => startRanking({ force: true }));
}

// True when Chrome has disconnected this copy of the script (the extension was reloaded or updated
// while this tab was open). It can still draw, but chrome.* calls throw until the page is refreshed.
function extensionWasUpdated(err) {
  return !chrome.runtime?.id || /Extension context invalidated/i.test(err?.message || "");
}
const UPDATED_MESSAGE = "Degree Finder was updated. Refresh this page to keep using it.";

// Updates the status line and, optionally, the progress bar (fraction 0–1, or null to hide it)
function setStatus(text, fraction = null) {
  ui.status.textContent = text;
  ui.progress.hidden = fraction === null;
  if (fraction !== null) ui.progressFill.style.width = `${Math.round(fraction * 100)}%`;
}

// Link to Stellic's own page for a program
function programUrl(id) {
  return `/app/program/info?id=${encodeURIComponent(id)}`;
}

// Renders one program as a list row (clicking it opens the program's page in a new tab).
// `rank` is the program's position in the full ranking, so it stays the same while searching.
function rowHtml(r, rank) {
  const total = r.unitsCompleted + r.unitsLeft;
  const percent = total > 0 ? Math.round((r.unitsCompleted / total) * 100) : 0;
  const reqs = `${r.numRemaining} requirement${r.numRemaining === 1 ? "" : "s"} left`;
  const fallback = student && r.catalog !== student.catalogYear
    ? ` title="Your catalog year isn't available for this program; using ${escapeHtml(r.catalog)}"`
    : "";

  const right = r.satisfied
    ? `<span class="done">Complete</span>`
    : `<div class="left"><b>${r.unitsLeft}</b><small>credits left</small></div>`;

  // Rows ranked before program IDs were saved can't link anywhere, so they stay plain
  const tag = r.id != null ? "a" : "div";
  const href = r.id != null
    ? ` href="${programUrl(r.id)}" target="_blank" rel="noopener" title="Open ${escapeHtml(r.name)} in Stellic"`
    : "";

  return `
    <li class="row">
      <${tag} class="row-link"${href}>
      <span class="rank">${rank}</span>
      <div class="row-main">
        <div class="name">${escapeHtml(r.name)}</div>
        <div class="meta"${fallback}>${escapeHtml(r.catalog)} · ${r.satisfied ? "all requirements met" : reqs}</div>
        <div class="bar"><span style="width:${percent}%"></span></div>
      </div>
      ${right}
      </${tag}>
    </li>
  `;
}

// Renders the active tab's list, limited to the top N picked in the dropdown
function renderList() {
  if (!currentResults) {
    ui.list.innerHTML = "";
    return;
  }

  const { majors, minors } = splitResults(currentResults.ranked);
  ui.tabs[0].textContent = `Second majors (${majors.length})`;
  ui.tabs[1].textContent = `Minors (${minors.length})`;

  // Keep each program's real rank, then filter by the search text, then apply "Show top N"
  const items = (activeTab === "majors" ? majors : minors)
    .map((r, i) => ({ r, rank: i + 1 }))
    .filter(({ r }) => !searchQuery || r.name.toLowerCase().includes(searchQuery));
  const visible = topK === 0 ? items : items.slice(0, topK);

  const emptyText = searchQuery
    ? `No programs match "${escapeHtml(ui.search.value.trim())}".`
    : "No programs found.";

  ui.list.innerHTML = visible.length
    ? visible.map(({ r, rank }) => rowHtml(r, rank)).join("")
    : `<li class="empty">${emptyText}</li>`;
}

// Shows saved results if they're still valid; otherwise (or if force is true) ranks everything
async function startRanking({ force = false } = {}) {
  if (running) return;
  if (extensionWasUpdated()) {
    setStatus(UPDATED_MESSAGE);
    return;
  }
  running = true;
  ui.rerank.disabled = true;

  try {
    if (!student) {
      setStatus("Loading your info…");
      student = await fetchStudentInfo();
      console.log("Logged in as", student.username, "| catalog year", student.catalogYear);
    }

    if (!force) {
      setStatus("Checking for saved results…");
      const saved = await loadResults();
      if (saved && (await savedResultsStillValid(saved))) {
        currentResults = saved;
        renderList();
        setStatus(`Your audit hasn't changed · ranked ${timeAgo(saved.savedAt)}`);
        return;
      }
    }

    setStatus("Fetching programs…", 0);
    const programs = await fetchAllPrograms();
    const candidates = filterCandidates(programs);

    const results = await rankPrograms(candidates, (done, total) => {
      setStatus(`Ranking ${done} of ${total} programs…`, done / total);
    });

    await saveResults(results);
    currentResults = { ...results, savedAt: Date.now() };
    renderList();
    setStatus("Ranked just now");
  } catch (err) {
    if (extensionWasUpdated(err)) {
      setStatus(UPDATED_MESSAGE);
    } else {
      console.error("Ranker error:", err);
      setStatus(`Something went wrong: ${err.message}`);
    }
  } finally {
    running = false;
    ui.rerank.disabled = false;
  }
}

createUI();