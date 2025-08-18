+# LearnLoom — Dashboard & Notes QA + Perf Baseline
+
+This checklist verifies the recent dashboard/notes refactor (virtualized list, server pagination, debounced search, shared NotesModal, RUM) and captures a lightweight performance baseline for future regressions.
+
+> Scope: Next.js App Router · Prisma (MySQL) · Dashboard Notes panel · ReadingPal NotesModal · RUM (`lib/rum.js`).
+
+---
+
+## 1) Functional QA
+
+### A. Notes basics
+- [ ] **Create** a note from Dashboard (New note → shared modal; pick type via dropdown).
+- [ ] **Edit** a note (opens modal with seeded body/tags/color/bookmark).
+- [ ] **Delete** a note (confirm → disappears from list).
+- [ ] **Type filter** works (`All | Books | Uploads | Grammar`).
+- [ ] **Tag chips** filter; clicking a chip toggles; “Clear tag” resets.
+- [ ] **Search** (300ms debounce):
+  - [ ] Matches in **body**
+  - [ ] Matches in **anchorText**
+  - [ ] Matches in **tags** (e.g., `#vocab`)
+- [ ] **Reset filters** button appears when any filter/search is active and clears all.
+- [ ] **Empty state**:
+  - [ ] No notes at all → “Create your first note” CTA works.
+  - [ ] Notes exist, but filtered to 0 → shows smart hint with quick actions (clear search/tag/reset).
+
+### B. Pagination & Virtualization
+- [ ] Initial page loads ~50 items (server `limit=50`, `fields=lite` when not searching).
+- [ ] **Load more** button fetches the next page (`nextCursor` used).
+- [ ] **Auto-prefetch**: Scrolling near the end triggers a background fetch (no duplicate adds).
+- [ ] De-duplication on append (same `id` isn’t added twice).
+- [ ] Virtual scrolling feels smooth (no large layout jank on long lists).
+
+### C. Deep links / anchors
+- [ ] Book note → “Open” goes to `/readingpal?bookIndex=…&chapterIndex=…`.
+- [ ] Upload note → “Open” goes to `/readingpal?upload=…`.
+- [ ] Grammar note → “Open” goes to `/grammar?concept=…&subTopic=…&start=1`.
+
+### D. ReadingPal ↔ Dashboard parity
+- [ ] Creating notes in ReadingPal shows up on Dashboard after refresh.
+- [ ] Bookmark toggle persists and displays as `bookmark` tag pill.
+
+### E. Accessibility
+- [ ] Modal ESC to close; close button labeled (`aria-label="Close"`).
+- [ ] Inputs and interactive elements have `aria-label`s where appropriate.
+- [ ] Focus returns to “New note” trigger when modal closes (browser default is fine for now).
+
+### F. Error handling
+- [ ] Simulate a network error on `/api/notes` (devtools → block request) → user-visible error message and a clean recovery after un-block + refresh or clicking **Load more** again.
+
+---
+
+## 2) RUM (analytics) sanity
+
+Open DevTools console and verify the following events log (dev fallback) or fire to your analytics:
+- [ ] `dash_mount` once on page mount.
+- [ ] `dash_quickresume_loaded` after `/api/quickresume`.
+- [ ] `notes_loaded` after the first notes fetch (properties: `count`, `q`, `tags`, `type`, `lite`).
+
+---
+
+## 3) Perf baseline (manual)
+
+> Goal: establish simple, repeatable numbers to compare later changes.
+
+### A. Build size (local)
+1. `npm run build`
+2. Note:
+   - [ ] Next build time: `___s`
+   - [ ] `.next` output total (approx): `___ MB`
+
+### B. Runtime (DevTools)
+1. Throttle **Network: Slow 3G** and **CPU: 4×** in Performance panel.
+2. Load `/dashboard` in a **fresh** session (clear cache & storage).
+3. Capture:
+   - [ ] **First Notes render** — time from navigation start to first notes list paint: `___ ms`
+   - [ ] Number of **script** requests and total JS transfer: `___ / ___ kB`
+   - [ ] `/api/notes` latency: P50 `___ ms` · P95 `___ ms`
+   - [ ] Initial API calls present: `/api/quickresume`, `/api/metrics?days=7`, `/api/notes?...`
+
+### C. Suggested budget (non-blocking)
+- First Notes render: ≤ **2.5s** on Slow 3G / 4× CPU.
+- Initial JS transfer (network): ≤ **250 kB** (minified, gzipped).
+
+Record your numbers here:
+
+| Metric | Value | Notes |
+|---|---:|---|
+| Next build time |  |  |
+| `.next` size (approx) |  |  |
+| First Notes render (Slow 3G, 4× CPU) |  |  |
+| JS requests / total kB |  |  |
+| `/api/notes` P50 / P95 |  |  |
+| Initial API calls present |  |  |
+
+---
+
+## 4) Quick commands
+
+```bash
+# unit tests (query builder)
+npm run test
+
+# dev server
+npm run dev
+
+# production build
+npm run build && npm start
+```
+
+---
+
+## 5) Known risks / watchouts
+- FTS requires MySQL full-text index on `Note.body` and `Note.anchorText`. If missing, API falls back to `contains` (slower). Ensure migration ran.
+- Relevance sort uses offset pagination (`nextCursor` as numeric string). Non-search uses stable `(createdAt desc, id desc)` with id cursor.
+- Virtualizer uses a measured height fallback; very long note bodies will be measured after first render—watch for layout thrash if large.
