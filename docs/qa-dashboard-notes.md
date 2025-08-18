# Dashboard + Notes Refactor — QA & Perf Sanity

## Functional
- [ ] Notes: create via Dashboard modal (type=grammar/book/upload)
- [ ] Notes: edit/update color/tags/body; delete
- [ ] Notes: type filter, tag chips filter, search with debounce & highlight
- [ ] Notes: cursor/infinite load (scroll + fallback button)
- [ ] Notes: smart empty states (no notes vs. no results)
- [ ] Reading/Upload/Grammar "Quick Resume" links work
- [ ] Grammar insights "Practice" links work

## Performance (dev/staging)
- [ ] Initial dashboard render is responsive before charts & RecentGrammarCard load
- [ ] Network: `/api/notes` first page includes `fields=lite` (unless searching)
- [ ] Network: subsequent notes page includes `cursor=...` until `nextCursor=null`
- [ ] Network: typing search triggers only 1 request per pause (~300ms)
- [ ] Chunks: RecentGrammarCard is code-split (loaded after main UI)
- [ ] (Optional) RUM: `dash_mount`, `notes_loaded`, `chart_rendered` events visible

## Accessibility
- [ ] NotesModal: `Esc` closes; `autoFocus` on textarea
- [ ] Buttons/links have accessible names; color indicators not sole signal
- [ ] Keyboard can reach “Load more” fallback

## Smoke on mobile
- [ ] Modal fits viewport; scrolls body correctly
- [ ] Chips/filters are tappable; infinite scroll not too aggressive
