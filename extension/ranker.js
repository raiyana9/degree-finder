// ============================================================
// Ranking
// ============================================================

// How many what-ifs to run at the same time
const CONCURRENCY = 20;

// Runs a what-if for every candidate, a few at a time.
// Calls onProgress(done, total) after each program so the UI can show progress.
// Returns the sorted ranking, plus what we need to detect changes later.
async function rankPrograms(candidates, onProgress = () => {}) {
  const ranked = [];
  let lastComputed = null;  // Stellic's timestamp for your audit
  let checkVersion = null;  // a program version we can re-check cheaply later
  let next = 0;
  let done = 0;

  async function worker() {
    while (next < candidates.length) {
      const program = candidates[next];
      next++;

      try {
        const versions = await fetchAuditVersions(program.id);
        const version = pickVersion(versions);

        if (version) {
          const result = await runWhatIf(version);

          ranked.push({
            id: program.id,
            name: program.name,
            kind: program.type === TYPE_MINOR ? "Minor" : "Second major",
            catalog: version.name,
            unitsLeft: result.unitsLeft,
            unitsCompleted: result.unitsCompleted,
            numRemaining: result.numRemaining,
            satisfied: result.satisfied,
          });

          if (!lastComputed) {
            lastComputed = result.lastComputed;
            checkVersion = version;
          }
        } else {
          console.log("Skipping (no published version):", program.name);
        }
      } catch (err) {
        console.warn("Failed:", program.name, err);
      }

      done++;
      onProgress(done, candidates.length);
    }
  }

  const workers = [];
  for (let w = 0; w < CONCURRENCY; w++) {
    workers.push(worker());
  }
  await Promise.all(workers);

  ranked.sort((a, b) => a.unitsLeft - b.unitsLeft || a.numRemaining - b.numRemaining);
  return { ranked, lastComputed, checkVersion };
}

// Splits the ranking into second majors and minors (order is preserved)
function splitResults(ranked) {
  return {
    majors: ranked.filter(r => r.kind === "Second major"),
    minors: ranked.filter(r => r.kind === "Minor"),
  };
}

// ============================================================
// Saved results
// ============================================================

// Bump this whenever the ranking logic changes, so old saved results are ignored
const CACHE_VERSION = 3;

// Saved results are a safety net: never reused after 30 days
const RESULTS_MAX_AGE = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds

// Each student's results are saved under their own key, tagged with the cache version
function resultsKey() {
  return `results_v${CACHE_VERSION}_${student.username}`;
}

// Saves the ranking and change-detection info, with the current time
async function saveResults({ ranked, lastComputed, checkVersion }) {
  await chrome.storage.local.set({
    [resultsKey()]: { savedAt: Date.now(), ranked, lastComputed, checkVersion },
  });
}

// Loads saved results, or returns null if there are none or they're too old
async function loadResults() {
  const stored = await chrome.storage.local.get(resultsKey());
  const saved = stored[resultsKey()];

  if (!saved) return null;
  if (Date.now() - saved.savedAt > RESULTS_MAX_AGE) return null;
  return saved;
}

// Returns true if your audit hasn't changed since the results were saved
async function savedResultsStillValid(saved) {
  if (!saved.lastComputed || !saved.checkVersion) return false;

  try {
    const current = await runWhatIf(saved.checkVersion);
    return current.lastComputed === saved.lastComputed;
  } catch (err) {
    console.warn("Couldn't check for changes; re-ranking.", err);
    return false;
  }
}