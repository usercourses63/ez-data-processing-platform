---
phase: quick-260602-odp
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/Frontend/src/App.css
autonomous: false
requirements: [ODP-HEADER-RTL-01]

must_haves:
  truths:
    - "In English (default/LTR), the page header title and subtitle are left-aligned (not centered)"
    - "In Hebrew (.rtl), the page header title and subtitle are right-aligned"
    - "Existing .rtl .page-header rules continue to work unchanged"
  artifacts:
    - path: "src/Frontend/src/App.css"
      provides: "Direction-aware page-header alignment (LTR left, RTL right)"
      contains: "align-items: flex-start"
  key_links:
    - from: ".page-header"
      to: "LTR default rendering"
      via: "align-items: flex-start + text-align: left on title block"
      pattern: "\\.page-header\\s*\\{[^}]*align-items:\\s*flex-start"
---

<objective>
Fix the page header alignment so it follows reading direction: English (default/LTR)
left-aligns the title + subtitle; Hebrew (.rtl) right-aligns them.

Purpose: The base `.page-header` rule uses `align-items: center` (combined with the
recently added `flex-direction: column`), which centers the English header instead of
left-aligning it. The `.rtl` case already right-aligns correctly. We only need to fix
the default/LTR case without breaking the existing `.rtl` rules.

Output: Updated `src/Frontend/src/App.css` with a direction-correct base `.page-header`.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@src/Frontend/src/App.css
@src/Frontend/src/components/shared/PageHeader.tsx

Relevant CSS facts (App.css):
- Base `.page-header` (~line 132): `display:flex; flex-direction:column; justify-content:space-between; align-items:center; ...`. The `align-items:center` centers the LTR header — this is the bug.
- `.rtl .page-header` (~line 142): already sets `flex-direction:column; align-items:flex-end; gap:16px`, and `.rtl .page-header > div:first-child` sets `text-align:right`. Keep these intact.
- There is NO explicit LTR/left rule today.

DOM note (PageHeader.tsx): the title block lives inside nested `> div` children; the
title is an h1/Typography Title and the subtitle is `.page-subtitle` / Typography Text.
This is a CSS-only fix — do NOT change the component markup.
</context>

<tasks>

<task type="auto">
  <name>Task 1: Make base .page-header left-align in LTR while preserving .rtl right-align</name>
  <files>src/Frontend/src/App.css</files>
  <action>
    Edit the base `.page-header` rule (~line 132-140). Change `align-items: center` to
    `align-items: flex-start` so the column-flex header aligns its children to the start
    (left) edge in the default LTR direction. Keep `display:flex`,
    `flex-direction:column`, `justify-content:space-between`, `margin-bottom`,
    `padding-bottom`, and `border-bottom` unchanged.

    Add an explicit LTR title-block alignment rule mirroring the existing
    `.rtl .page-header > div:first-child` rule, but for the default case:
    `.page-header > div:first-child { text-align: left; }` so the title + subtitle text
    aligns left in English. Place it immediately after the base `.page-header` block and
    BEFORE the `.rtl .page-header` block so the `.rtl` selectors (higher specificity)
    still override for Hebrew.

    Do NOT modify any `.rtl .page-header*` selector — they already produce correct RTL
    right-alignment. Do NOT touch PageHeader.tsx or any page component markup.
  </action>
  <verify>
    <automated>node -e "const fs=require('fs');const c=fs.readFileSync('src/Frontend/src/App.css','utf8');const base=c.match(/\.page-header\s*\{[^}]*\}/);if(!base) throw new Error('base .page-header rule not found');if(!/align-items:\s*flex-start/.test(base[0])) throw new Error('base .page-header must use align-items: flex-start');if(/align-items:\s*center/.test(base[0])) throw new Error('base .page-header still centers');if(!/\.rtl\s+\.page-header\s*\{[^}]*align-items:\s*flex-end/.test(c)) throw new Error('.rtl .page-header flex-end rule was lost');process.stdout.write('OK');"</automated>
  </verify>
  <done>
    Base `.page-header` uses `align-items: flex-start` (no `center`); an LTR
    `.page-header > div:first-child { text-align: left; }` rule exists before the `.rtl`
    block; all `.rtl .page-header*` rules are unchanged. The verify command prints `OK`.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>
    Direction-aware page header alignment in App.css: English (LTR) left-aligns the
    header title + subtitle; Hebrew (RTL) right-aligns them.
  </what-built>
  <how-to-verify>
    1. Ensure the frontend is running (http://localhost:7000) — start it if needed
       (`cd src/Frontend; npm start` or via the existing dev workflow).
    2. Open any page with a page header (e.g. Data Sources list / Dashboard) in English.
       Confirm the page title and subtitle are LEFT-aligned (flush to the left edge of
       the content area), NOT centered.
    3. Switch the UI language to Hebrew (language toggle). Confirm the title and subtitle
       are RIGHT-aligned, and the header layout still looks correct (no overlap, action
       buttons positioned sensibly).
    4. Switch back to English and confirm it returns to left-aligned.
  </how-to-verify>
  <resume-signal>Type "approved" if both LTR (left) and RTL (right) alignment are correct, or describe what looks wrong.</resume-signal>
</task>

</tasks>

<verification>
- App.css base `.page-header` no longer centers header children in LTR.
- `.rtl .page-header` right-alignment rules remain intact.
- No component markup (PageHeader.tsx or page components) was modified.
- Visual check confirms English left-aligned, Hebrew right-aligned.
</verification>

<success_criteria>
- English/default page header: title + subtitle left-aligned.
- Hebrew/.rtl page header: title + subtitle right-aligned.
- CSS-only change confined to `src/Frontend/src/App.css`.
- Automated verify command prints `OK`.
</success_criteria>

<output>
Create `.planning/quick/260602-odp-in-the-ui-page-header-when-hebrew-align-/260602-odp-SUMMARY.md` when done
</output>
