/**
 * Export format versioning.
 *
 * VERSION HISTORY:
 *   v0 (legacy) — no version field in JSON. icon/color may contain "null" strings.
 *   v1          — added version field. Sanitized icon/color/type values.
 *   v2          — aligned with DB schema v2. Same entity shape as v1,
 *                 establishes the convention: export version = schema version.
 *   v3          — WCAG 2.2 color compliance. Remaps old category/debtor colors
 *                 to the new accessible palette. DB schema stays at v2 (no schema
 *                 changes, only data-level color values).
 *   v4          — Added budgets table (DB schema v3). Exports now include
 *                 budget entries with amount, month, budgetType.
 *   v5          — Budget entries may reference a category, and weekly limits
 *                 are represented by budgetType + recurring-weekly period keys.
 *                 Optional display preferences are included; account credentials are not.
 *   v6          — Investment portfolios include contributions, withdrawals,
 *                 monthly valuations, and reminder preferences.
 *   v7          — Investment types are user-managed and optional. Type definitions
 *                 travel with the portfolio so custom labels survive a restore.
 *   v8          — Trading journal: trades with pair, direction, leverage, average
 *                 price, strategy, reason, risk/reward, and PnL, plus custom
 *                 strategy/pair registries and monthly opening balances.
 *   v9          — Monthly automations: recurring expense, investment
 *                 contribution, and debt schedules with pause state and resume
 *                 cursors. References travel as names and are remapped on restore.
 *
 * RULES:
 *   - Bump when the ExportData shape or data semantics change.
 *   - Add a corresponding upgrader step in upgrader.ts (vN → vN+1).
 *   - NEVER remove old upgrader steps — a v0 file must still import into a v99 app.
 *
 * FILE NAMING:
 *   Exported files are named: zero_v{version}_{timestamp}.json
 *   Example: zero_v3_20260321163018.json
 *   The version in the filename matches the version inside the JSON.
 */
export const CURRENT_EXPORT_VERSION = 9;

export type {ExportData, ExportEnvelope} from './validate';
