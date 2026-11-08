console.log("Degree Finder API loaded");

// ============================================================
// Stellic API
// ============================================================

// Reads the CSRF token from Stellic's cookie
function getCsrfToken() {
  const cookies = document.cookie.split("; ");
  const tokenCookie = cookies.find(c => c.startsWith("csrftoken="));
  return tokenCookie ? tokenCookie.split("=")[1] : null;
}

// Gets the logged-in student's username and catalog year from Stellic
async function fetchStudentInfo() {
  const response = await fetch("/planner/getinitdata/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken": getCsrfToken(),
      "X-Requested-With": "XMLHttpRequest",
    },
    body: JSON.stringify({}),
  });
  const text = await response.text();
  const data = JSON.parse(text.slice(text.indexOf("{")));

  if (!data.username) throw new Error("Couldn't find username — are you logged in?");

  const baseYear = data.student_data?.base_year;
  return {
    username: data.username,
    catalogYear: baseYear ? `CY${baseYear}-${baseYear + 1}` : null,
  };
}

let student = null; // filled in the first time the ranker runs

// Stellic answers small pages much faster than big ones, so ask for many small pages at once
const PROGRAMS_PAGE_SIZE = 20;
const PAGES_PER_BATCH = 10;

// Fetches one page of second majors and minors, starting at `from`
async function fetchProgramsPage(from) {
  const response = await fetch("/search/programs/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken": getCsrfToken(),
      "X-Requested-With": "XMLHttpRequest",
    },
    body: JSON.stringify({
      filters: [{
        type: "MULTITERMS",
        field: "type.id",
        values: [TYPE_SECOND_MAJOR, TYPE_MINOR],
        operator: "ANY",
      }],
      size: PROGRAMS_PAGE_SIZE,
      from: from,
    }),
  });

  const text = await response.text();
  return JSON.parse(text.slice(text.indexOf("{")));
}

// Fetches every page, a batch of pages at a time, until a batch includes the last page
async function fetchAllPrograms() {
  let allPrograms = [];
  let from = 0;

  while (true) {
    const starts = Array.from({ length: PAGES_PER_BATCH }, (_, i) => from + i * PROGRAMS_PAGE_SIZE);
    const pages = await Promise.all(starts.map(fetchProgramsPage));

    for (const page of pages) allPrograms = allPrograms.concat(page.data_list);

    const reachedEnd = pages.some(p => p.last_page || p.data_list.length < PROGRAMS_PAGE_SIZE);
    if (reachedEnd) break;
    from += PAGES_PER_BATCH * PROGRAMS_PAGE_SIZE;
  }

  console.log("Fetched", allPrograms.length, "programs");
  return allPrograms;
}

// Program types we want to rank: 30 = second majors, 31 = minors
const TYPE_SECOND_MAJOR = 30;
const TYPE_MINOR = 31;

// Keeps only second majors and minors
function filterCandidates(programs) {
  return programs.filter(
    p => p.type === TYPE_SECOND_MAJOR || p.type === TYPE_MINOR
  );
}

// Fetches all catalog-year versions of one program
async function fetchAuditVersions(programId) {
  const response = await fetch(`/planner/getauditversions/?program=${programId}`, {
    headers: { "X-Requested-With": "XMLHttpRequest" },
  });

  const text = await response.text();
  const data = JSON.parse(text.slice(text.indexOf("{")));
  return data.audits;
}

// Picks the student's catalog-year version if it exists, otherwise the newest published one
function pickVersion(versions) {
  const published = versions.filter(v => v.status === "published");
  published.sort((a, b) => b.name.localeCompare(a.name));

  const v =
    published.find(v => v.name === student.catalogYear) || published[0];
  if (!v) return null;

  return {
    id: v.id,
    name: v.name,
    status: v.status,
    concentrations: v.concentrations,
    requirement: v.requirement,
  };
}

// Runs a what-if audit for one program version and returns the key numbers
async function runWhatIf(version) {
  const response = await fetch("/planner/getauditinfo/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken": getCsrfToken(),
      "X-Requested-With": "XMLHttpRequest",
    },
    body: JSON.stringify({
      student_username: student.username,
      audit: version.id,
      default_audit_version: version,
      official: true,
      req_tree: false,
      course_plan_info: false,
      student_info: false,
      placeholders_info: false,
      uids: [],
    }),
  });

  const text = await response.text();
  const data = JSON.parse(text.slice(text.indexOf("{")));

  const result = data.audit_data?.[version.requirement];
  if (!result) {
    console.log("Unexpected response:", data);
    throw new Error("No audit data for requirement " + version.requirement);
  }

  return {
    unitsLeft: result.units_left,
    unitsCompleted: result.units_completed,
    numRemaining: result.num_remaining,
    satisfied: result.satisfied,
    lastComputed: data.last_computed,
  };
}