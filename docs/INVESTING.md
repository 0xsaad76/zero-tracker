# Investment tracking

Zero starts with mutual funds, gold, silver, and emergency cash as suggested investment types. Users can add, rename, or delete types, and every investment may instead use **No type**. Deleting a type detaches its investments but never deletes the investments or their history. Multiple accounts of each type are supported. Records live in the signed-in user's Supabase account; the Android device keeps only opaque reminder IDs and dates.

## Entries and calculations

- A **contribution** adds money to an investment.
- A **withdrawal** records money taken out.
- A **monthly valuation** is the investment's total value on a user-entered date. It is the monthly update requested by the app.
- Net invested is contributions minus withdrawals.
- Gain/loss at a valuation is the valued amount minus net contributions through that date. Deposits are therefore not counted as profit.
- Monthly gain/loss requires a valuation for the preceding month. A transaction after the current month's valuation marks it stale and requires another update.
- Missing valuations remain unknown. Reports do not convert missing data to zero or carry an old valuation forward as a completed month.

Valuations are treated as end-of-day values, so a contribution or withdrawal on the same date should already be included in the entered value.

## Android reminders

Each investment can choose a review day from 1 to 31. Shorter months use their last day. Android schedules an inexact alarm around 9 AM local time; battery controls may delay delivery. Alarms are restored after reboot, app replacement, timezone changes, and clock changes.

Notification permission is requested only when a user enables a reminder. A completed, non-stale valuation suppresses that month's reminder. Up to 100 reminders can be enabled. Signing out clears the device schedule before credentials are removed.

Reminder storage never contains account IDs, investment names, balances, transactions, or valuations. The notification is intentionally generic and private on the lock screen.

## Backup compatibility

JSON export format v7 includes investments, their entry history, and the type registry. Importing a v6 backup keeps the original four default types. Importing an older backup leaves an existing portfolio untouched. "Delete all data" explicitly removes investments and customized investment types. The v3 cloud reader supports optional/custom types; the v2 reader exposes only investments using its original four known types, so a mixed-version save cannot remove records an older build cannot decode.
