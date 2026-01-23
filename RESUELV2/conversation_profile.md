# Zepra Notes AI - Conversation Profile (Context Key)

Date: 2026-01-22
Project Path: C:\Users\A1\Videos\zepra1-codex-review-and-remove-gemini-template-eptxd6\RESUELV2

## Goal
Build "Notes with AI" feature in Zepra Menu with Manual / Select Text / Capture Note flows, AI formatting, modern English UI, and AI-driven PDF export layouts. Ensure PDF exports download automatically without manual tab activation. Maintain English UI across the extension.

## What Was Implemented
### New Files
- notes.html (Notes Hub UI)
- notes.css (Notes Hub styling)
- notes.js (Notes Hub logic: search, filters, selection, export, modal)
- notes_export.html (Notes export template)
- notes_export.js (Notes export renderer that triggers export after render)
- personas_export.js, memory_export.js, identities_export.js (moved inline scripts to external JS to satisfy MV3 CSP)

### Updated Files
- background.js
  - Added notes PDF filename type.
  - Added export creation via hidden popup window (1x1 offscreen) instead of normal tab.
  - Added OCR_IMAGE (OCR from image data URL).
  - Added GENERATE_NOTE (AI formatting for notes).
  - Added GENERATE_NOTES_EXPORT (AI layout generation using Qwen-3-480B, with fallback and template instructions).
  - Added OPEN_NOTES_PANEL message to open notes.html.
  - Added model override support in callCerebras.
  - Added buildNotesExportPrompt + buildNotesExportFallback.
- content.js
  - Added "Notes with AI" entry in Zepra Menu.
  - Added flows: Manual Note, Select Text, Capture Note (with OCR options) and note composer UI.
  - Notes menu now closes before launching flows.
  - English strings enforced in the new notes UI.
- notes.js
  - English UI text; export steps animation overlay.
  - Selection mode, export, and improved Open Note modal styling.

## Known Critical Fixes
- MV3 CSP: Inline scripts in export templates broke PDF render. Moved to external JS files.
- Background service worker crash: buildNotesExportPrompt was missing closing template string; fixed by reinserting ${STRICT_JSON} and restoring buildNotesExportFallback.
- PDF export required manual tab activation: switched export rendering to hidden popup window and close after print.

## Current Behavior
- Notes Hub opens from menu.
- Manual/Select/Capture note creates AI note and saves to storage.
- Export uses Qwen-3-480B and should output variable layouts each time (prompt instructs this).
- Fallback export template exists to prevent failures.
- Export should download without opening a visible tab.

## User Feedback / Issues
- User reported: PDF export opens a new tab and only downloads after clicking that tab.
  - **FIX APPLIED**: Changed export window to `focused: true` and increased render delay to 600ms
- User reported: Export layouts look bad and too uniform (same template), wants creative layouts per export.
  - **FIX APPLIED**: Enhanced prompt with random layout selector, 14-point content checklist, stronger creative instructions
- User reported: "Open Note" modal looked poor; updated to modern layout but user still evaluating.
- User wants: English-only UI across all extension surfaces.
- User wants: UI polish, modern design, better image display in notes.

## Latest Changes (2026-01-23)
1) **Export window focus**: Changed from `focused: false` to `focused: true` to ensure proper rendering
2) **Export timing**: Increased delay from 200ms to 600ms before PDF print
3) **Export loader**: Added visual loader overlay during PDF generation in notes_export.js
4) **Enhanced AI prompt**: 
   - Added random layout selector (8 different layout styles)
   - Explicit 14-point content display checklist
   - Stronger creative instructions with "WORLD-CLASS" framing
   - Better single-note full-page layout instructions
   - Increased rawText/ocrText limits to 800 chars

## Pending Tasks / Next Steps
1) User to test: PDF export should now download automatically without manual tab interaction
2) User to test: Each export should look visually different with varied layouts
3) User to test: All note content (insights, actions, questions, glossary) should appear in export
4) Monitor: General extension features (logout, session timer, IP info, generate)

## Key Files to Check
- background.js (notes export prompt + fallback + export popup behavior)
- content.js (notes menu + composer flows)
- notes.html / notes.css / notes.js (UI/UX)
- notes_export.html / notes_export.js (PDF render)

## Notes on Export Prompt
- buildNotesExportPrompt includes strict JSON, layout variability instructions, A4 pagination requirement.
- VARIANT_SEED added (Date.now) to encourage variation.

## Storage Keys
- zepraNotes (array of notes)
- notesExportPayload (last export payload for PDF rendering)

## Troubleshooting Tips
- If extension stops working, check background.js for syntax errors (service worker crash disables all features).
- Reload extension after changes.

