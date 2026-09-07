# Monthly automations

Automations repeat a spending, SIP contribution, or debt entry on a chosen day each month, so SIPs, cash withdrawals, and recurring lends survive without manual re-entry. Creation is per-screen only: a "Repeat monthly" switch inside Add expense, Add debt, Add contribution, and Add investment — the last one takes an optional first contribution that posts on the start date while later months run automatically. There is no central screen; each screen lists its own schedules underneath.

## How it runs

Every launch, after sign-in and before the home screen opens, Zero posts all due automations in one cloud transaction. Each missed month posts backdated, and the current month posts once its day arrives — open the app after two months away and both SIPs land with the right dates, followed by one summary dialog of everything posted. Days clamp to short months (a 31st posts on the 28th/30th). Paused schedules never owe anything.

Creating an automation alongside a manual entry never duplicates it: the entry's month is recorded as already posted, so posting resumes the next month.

## Managing

Each screen's scheduled section shows its automations with day, amount, and pause state. Rows expand to edit the day and amount, pause or resume, and delete. Deleting stops future months; already posted entries stay. Schedules whose category, investment, or debtor was deleted are skipped (never deleted) and reported in the launch summary.

## Backup compatibility

JSON export format v9 adds automations. References travel as names and are remapped on restore; schedules pointing at records missing from the same backup are dropped. The v5 cloud reader is current while v4 and older hide automation rows, so a mixed-version save cannot remove schedules an older build cannot decode. Automation writes before the v5 migration fail with a clear "cloud update" message instead of a connection error.
