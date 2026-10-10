# Phase 1 Plan — Civic Tech Research Portal

Status: **parked / high-level only** — not yet scoped to implementation detail.

## Source

Flowchart: [Figma board](https://www.figma.com/board/Vqe4cyALRFCiZ2ZaoRFyVu/Untitled?node-id=1-2) — "Researcher Portal" flow.

## Goal

Restructure the Marketing-RAG-Dashboard prototype into a civic tech research portal: users search/browse a real knowledge base (built from an existing Obsidian vault) and read topic documents. Existing marketing-content-generation features stay, as additional actions alongside the new flow — this is additive, not a replacement.

## Flow (from the board)

```
Researcher Portal
  -> Choose Action
       -> Ingest Documents
            -> Input Method (Upload Files | Paste Text)
            -> Extract & Parse Content
            -> Auto-Detect or Assign Topic Category
            -> Save to Research Repository
            -> Document Store (from GitHub repo)
       -> Search & Retrieve
            -> Enter Search Query
            -> Search Across Document Frontmatter
            -> Document Store
       -> Analyze Research
            -> Document Store
  Document Store
       -> Return Matching Results -> Display Retrieved Documents
       -> Compute Metrics (Total Files, Total Topics, Avg Files/Topic) -> Display Analytics Dashboard -> End: Insights Ready
```

## Decisions made

- **Keep, don't replace**: Generate Content, Find Patterns, and Chat AI Setup remain in the dashboard as-is. Ingest/Search/Analyze are *added* as new actions, not a rebuild of the whole app.
- **Content domain**: civic tech research notes, not the current healthcare-marketing mock content. Goal is for users to read real topic documents when searching.
- **Data backing**: real — sourced from the user's existing Obsidian vault, not simulated mock data (unlike the current Generate/Ingest/Find Patterns flows, which are all client-side mocks).

## Open questions — answered (2026-10-10)

1. **Vault location** — local only, not git-synced: `/Users/krizfernux/Obsidian Vault` (33 `.md` files total, no `.git`). Contains a nested sub-vault `ant-colony/` (its own `.obsidian`) plus a top-level `Clippings/` folder.
2. **Note structure** — mixed:
   - Web-clipped notes (`Clippings/`, and `ant-colony/Clippings/`) have real frontmatter: `title`, `source` (URL), `author` (as a `[[wikilink]]`), `published`, `created`, `description`, `tags` (currently just `["clippings"]`, not topical).
   - Freeform notes (`ant-colony/*.md` root-level — critical thinking chapters, AI ethics reflections, LinkedIn/dev.to notes) have no frontmatter, light `[[wikilinks]]`, no consistent structure.
3. **Topic categorization** — existing tags/folders are not topic-differentiated (tags just mark "clippings" as a type; folders aren't subject-based), so this needs **real keyword-based categorization logic** (same pattern as help-center-chat's `searchArticles` scoring), not a passthrough of existing metadata. Vault content theme skews AI ethics / algorithmic bias / critical thinking — fits the civic-tech framing.

## Still open before Phase 2 scoping

- How to handle the two structurally different note types (clipped-with-frontmatter vs. freeform) in one ingest/parse pipeline — normalize freeform notes into the same shape, or support both as distinct document types?
- How to handle the nested `ant-colony` sub-vault (own `.obsidian`) — treat as one combined corpus with the parent vault, or keep separate?
- Whether the 33-file vault is loaded by filesystem read (static export, e.g. a build step copying into `public/`) vs. some live local file access — no git remote exists yet, so "Document Store from github repo" per the flowchart isn't literal today.

## Not yet decided / deferred to Phase 2 scoping

- Whether "Document Store from github repo" means live GitHub API reads/writes (needs auth + backend) vs. a build-time export of the vault into the repo's `public/`-style static files.
- Exact mapping of "Search Across Document Frontmatter" to UI (results list design, currently `analyzeContent()` only fires a toast notification and doesn't render results).
- Metrics tile design for Total Files / Total Topics / Avg Files per Topic (likely replaces the currently-hidden Content Chunks/Queries/Avg Response/Accuracy metrics section).
