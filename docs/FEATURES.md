# Feature switches, income, search and the Home overview

## Feature switches

Settings → Features holds one switch per optional part of the app. Expenses, categories and reports are the core and are always on.

| Switch              | Off hides                                                                                          |
| ------------------- | -------------------------------------------------------------------------------------------------- |
| Income              | The income row on the Home card and the Income screen.                                             |
| Spending limits     | The limits rows in Settings, the progress card on Home, the budget bar in Reports, the daily hint. |
| Monthly automations | "Repeat monthly" on every add form, the scheduled sections, and the launch run.                    |
| Debts               | The Debts tab and its Home tile.                                                                   |
| Investing           | The Investing tab, its Home tile, and the Android review reminders.                                |
| Trading journal     | The Trading tab and its Home tile.                                                                 |

Switching a feature off only hides it. Records stay in the cloud and reappear when it is switched back on. Two side effects are worth knowing:

- **Automations** do not post while off. Their cursors are left alone, so switching back on catches up every missed month at the next launch, exactly like a long absence.
- **Investing** reminders are cancelled on the device while off and restored on the next data read after switching on.

The switches live in the cloud `settings` record under `preferences.features` and are mirrored to MMKV (`featureFlags`) so the tab bar can render before the first network read. Missing keys mean "on", so accounts and backups from before the switches behave as before. Code reads them through `src/features/flags.ts` (`useFeatureFlags` in components, `getFeatureFlags` elsewhere).

## Navigation

The tab bar is Home and Reports plus one tab for each of Debts, Investing and Trading that is switched on. Categories moved out of the tab bar: manage them from Settings → Spending → Categories, or add one from the add-expense form.

## Income

An income entry is a source, an amount, the day it arrived and an optional note. The Home card shows the month's income and what is left after spending (or how much was overspent); tapping that row opens the Income screen, which lists a month's entries and the share of income kept.

- Model and maths: `src/income/model.ts`. Cloud mutations: `src/income/service.ts`.
- Cloud record kind `incomes`, validated by `zero_valid_income`. The `income_records` migration adds read protocol **v6**; v5 and older hide income, so a mixed-version save cannot delete rows an older build cannot decode.
- Until that migration is applied to the live project, reads fall back to v5 and income writes fail with a clear "cloud update" message. Everything else keeps working.
- JSON export format **v10** adds `incomes` and the feature switches. Importing a v9 or older backup leaves existing income untouched. "Delete all data" removes income.

Income cannot repeat monthly yet; automations still cover spending, SIP contributions and debts only.

## Search

The magnifier on Home opens a search across every month. Each word must match the title, note, category, date (`YYYY-MM-DD`) or amount; amounts match by prefix, so `45` finds 45, 450 and 45.5. Category chips narrow the results, the header shows the count and total, and tapping a result opens it for editing. The matching rules are in `src/utils/expenseSearch.ts`.

## Home overview

Under the month card, one tile appears per enabled feature: net debt (you owe / owed to you), portfolio value for the selected month, and the trading journal's month PnL in its own currency. Each tile opens its tab. The numbers come from `buildOverview` in `src/screens/HomeScreen/useOverview.ts`.
