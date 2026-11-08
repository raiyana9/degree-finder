# Degree Finder

Degree Finder is a Chrome extension that ranks every UVA second major and minor by how close you are to finishing it.

You may be only a class or two away from a minor you never considered. Degree Finder runs a what-if audit for every second major and minor against the courses you've already taken, then ranks them by credits left.

## Features

- Separate tabs for second majors and minors
- Credits left, requirements left, and a progress bar for each program
- Search by name and choose how many results to show
- Click any program to open its full page in Stellic
- Uses your own catalog year, falling back to the newest published version when a program doesn't have yours
- Saves your results, so later visits load instantly. They update automatically when your audit changes.

## Install

**From the Chrome Web Store:** *(link coming soon)*

**From source (for development):**
1. Clone this repo.
2. Open `chrome://extensions` and turn on **Developer mode**.
3. Click **Load unpacked** and select the `extension/` folder.
4. Go to [Stellic](https://login.stellic.virginia.edu), log in, and click **Rank programs** in the bottom-right corner.

## How it works

Everything runs in your browser, using your existing Stellic login. The extension:

1. Reads your username and catalog year from `/planner/getinitdata/`.
2. Fetches the list of second majors and minors from `/search/programs/`. It uses a type filter and requests small pages in parallel.
3. For each program, picks a catalog version (`/planner/getauditversions/`) and runs a what-if audit (`/planner/getauditinfo/`), four at a time.
4. Sorts by credits left, then by requirements left, and caches the results in `chrome.storage.local`.

Later visits run a single what-if audit to check whether your audit has changed. If it hasn't, the cached results are shown.

```
extension/
├── manifest.json
├── api.js      # Stellic requests
├── ranker.js   # ranking, majors/minors split, caching
├── ui.js       # the panel (Shadow DOM)
└── icons/
```

## Privacy

Degree Finder has no server of its own. It sends nothing anywhere except the Stellic site you're already logged into, and it uses no analytics or tracking. See the [privacy policy](PRIVACY_POLICY_LINK).

## Limitations

- Rankings are estimates based on your current audit. Confirm requirements with your advisor before declaring a program.
- Each what-if audit is run on its own, so the results may not reflect limits on sharing credits between programs.

## Disclaimer

Degree Finder is an independent student project. It is not affiliated with or endorsed by the University of Virginia or Stellic.