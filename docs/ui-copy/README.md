# UI copy catalog (Consistency app)

This folder holds an **export of user-visible strings** from `index.html` so you can edit them in a spreadsheet or with another LLM, then merge improvements back into the codebase.

## Files

| File | Purpose |
|------|---------|
| **catalog.json** | Machine-readable catalog. **Primary round-trip format.** |
| **catalog.full.tsv** | Same data as tab-separated values (open in Excel / Google Sheets). Newlines in cells are escaped as `\n`. |

## Regenerate from source

After you change `index.html`, refresh the export:

```bash
node tools/extract-ui-copy.mjs
```

## What this catalog includes

- **Insights (adult)** — `INSIGHT_LIBRARY` titles, bodies, source attribution text.
- **Insights (kid)** — `_INSIGHT_KID_PART1` … `_INSIGHT_KID_PART5` (title, body, sourceText, blogText where present).
- **Settings (dynamic)** — Adult vs kid strings from `syncSettingsPanelsKidCopy()` (`setTxt` / `setHtml`).
- **Onboarding** — `ONBOARDING_WIZARD_COPY` and `ONBOARDING_INTRO_COPY` (adult + kid), including HTML intro steps.
- **Field tips** — `FIELD_TIP_COPY` (goal name, reward, habit title).
- **Grace offer stepper** — `GRACE_OFFER_STEPS_ADULT` / `_KID`.
- **Habit tier spotlight** — `HABIT_TIER_TUTORIAL_COPY`.
- **Insight category labels (kid)** — `INSIGHT_CATEGORY_LABELS_KID`.
- **Habit preset category labels** — `HABIT_PRESET_CATEGORY_LABELS`.
- **Habit presets** — `HABITPRESETS` / `HABITPRESETS_KID` (`label` and `title` per `key`).
- **Weekly reward presets** — `REWARD_PRESETS` (adult list only today).
- **Accent palettes** — `UI_PALETTE_OPTIONS` `label` and `sub` per theme id.

## What is **not** in the automated export (still only in `index.html`)

The app is mostly one large `index.html`. The extractor does not yet harvest:

- Static **HTML** copy: cookie banner, many **modals** (grace info, stop tracking, auth gate, guide / Tips article, goal & habit forms, import backup, confirmations, etc.).
- **Main chrome**: tab labels, section titles, button labels that are not wired through `syncSettingsPanelsKidCopy`.
- **Guided tour** — `_guidedTourSteps` / `_guidedTourStepsKid` (long inline objects).
- **Runtime UI** — strings built in `renderDashboard`, `renderTracker`, `renderHistory`, coaches, steppers, **browser notifications**, `alert()` / `confirm()` text, sync/auth messages, **aria-label** / **title** attributes.
- **Seed / demo** data (e.g. bank habit titles in `seedBankHabitRows`).

If you need those in the same pipeline, extend `tools/extract-ui-copy.mjs` or add a second pass; until then, treat **`catalog.json` + this list** as the full inventory of what is “automated” vs “still in markup/JS only.”

---

## Prompt for the *editing* AI (copy everything below this line)

You are editing **user-facing copy** for **Consistency**, a browser-based weekly habit tracker.

### Product context

- **Audience:** Adults and **children (roughly 0–8)**. Kid mode uses simpler vocabulary, shorter sentences, and often points caregivers to **Settings** or “grown-ups” for cloud, account, and complex rules.
- **Core ideas:** Goals with a savings **pot**, **weekly treats**, **habits** (core vs growth), **Monday–Sunday weeks**, **consistency %** on a disc, **grace period** for early weeks, **recovery** when a goal’s rolling % drops below its **floor** (often ~80%).
- **Tabs:** Dashboard, Log, Habits, History, Habit Bank. **Settings** includes Account (profiles + sign-in/sync), Appearance, Tracking, Advanced (backup / cloud snapshots), Help (tours, Tips), About.
- **Insights / “fun facts”:** Short optional reads; kid variants must stay **non-frightening**, non-clinical, and **not** promise medical outcomes.

### Your task

1. Open the attached **`catalog.json`** (or **`catalog.full.tsv`**).
2. For each row, improve **clarity, tone, and consistency** without changing **meaning** of rules (especially legal/security: sign-in, data location, backup behaviour).
3. Preserve:
   - **`id`** (stable key — do not change).
   - **`category`** and structural fields (`insight_id`, `locator`, `elementId`, `preset_key`, `palette_id`, `variant`, `meta`, `field`, `source_part`, etc.).
      - For rows with **`adult`** and **`kid`**, polish **both**; keep kid copy shorter and plainer.
   - For **`html: true`** rows, keep **HTML tags and structure** unless you are fixing a typo; do not strip required `<strong>`, `<p>`, `<ul>` wrappers used in-app.
   - **Placeholders** the engineering team relies on (if any appear in strings): leave tokens like `%s` or `{{…}}` unchanged unless the file contains none.
4. Do **not** add new rows or delete rows unless the user explicitly asked you to expand scope.

### Output format (required)

Return a **single JSON object** with the **same top-level shape** as the input:

```json
{
  "format_version": 1,
  "source_file": "index.html",
  "generated_note": "(optional — may match input)",
  "entries": [ /* same array length and ids as input; only text fields updated */ ]
}
```

If the tool only allows a **table**, return **one TSV or CSV** with columns:

`id`, `category`, `variant`, `adult`, `kid`, `html`

…using the **same `id` order** as `catalog.full.tsv`.

### Handoff back to the developer AI

The developer will map each **`id`** back into `index.html` (and possibly adjust `tools/extract-ui-copy.mjs` if structure changed). **Unique `id` values are critical** — do not rename them.

---

## Merging edited copy (for developers)

1. Save the other model’s output as e.g. `docs/ui-copy/catalog.edited.json`.
2. Diff against `catalog.json` to review scope.
3. Apply changes in `index.html` (or script replacements). **Verification:** run `node tools/extract-ui-copy.mjs` and diff the new `catalog.json` against `catalog.edited.json` for parity on edited ids.

There is **no automatic apply script** yet; add `tools/apply-ui-copy.mjs` when you want id → file patching with uniqueness checks.
