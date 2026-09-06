# Zero — Android expense tracker

This private-use Android fork of Zero uses Google sign-in and Supabase for financial records. Internet is required; signing into the same Google account after reinstalling retrieves its cloud data. No app-store deployment is planned.

## Features

- Expenses, custom categories, monthly reports, and debts.
- Overall and category-level weekly/monthly spending limits.
- Home budget progress with optional thin category bars and a Settings visibility toggle.
- Spending headers with weekday and date.
- Investment portfolios with optional user-managed types, contribution/withdrawal history, monthly valuations, Android reminders, and reports. Trading journal with pairs, strategies, leverage, risk/reward, monthly balances, filters, and reports.
- Automatic cloud writes after each successful save; no separate backup button.
- Explicit JSON restore/export and CSV export.
- Light, dark, and system themes; locale and currency preferences.
- Settings About contains only the app version.

## Stack

React Native 0.86.2, React 19.2.8, TypeScript 5, React Navigation 7, Redux Toolkit (RAM-only), Supabase Auth/Postgres JSONB, Zod, MMKV display preferences, and native Keychain session storage. WatermelonDB/SQLite remains only for migrating old installations and compatibility tests.

## Development

Use Node 22.13+ and Bun 1.3.14 (or `npx --yes bun@1.3.14`). Install the Android SDK and the NDK version declared in Gradle with their required licenses accepted.

```bash
bun install
bun run typecheck
bun run test --runInBand
bun run test:cloud-db
bun run android
```

For live preview, follow [Android emulator / phone steps](docs/ANDROID_PREVIEW.md). Expo Go is not compatible with this project's native modules.

See [cloud configuration and migration](docs/supabase-storage.md) for OAuth setup, privacy boundaries, concurrency, rollback, and current device-testing limitations. Public client identifiers live in `src/config/supabase.ts`; secrets must never go in the app.

New installations never write financial records to SQLite. Existing installations explicitly confirm the account for a verified migration before the old device copy is removed. Google session credentials, display preferences, and anonymous reminder dates are the only automatically persisted device state. Manual exports are user-requested local files.

Cloud persistence is not a backup against intentional deletion: deleting cloud records is permanent. Export JSON before destructive changes if you need a separate recoverable copy.

## Main code areas

- `src/cloud/`: cloud transactions, domain services, JSON transfer, legacy migration.
- `src/investments/`: investment validation, return calculations, cloud mutations, and Android reminder bridge.
- `src/context/CloudAuthContext.tsx`: login, session lifecycle, migration gate.
- `supabase/migrations/`: deployed SQL schema and owner-only security rules.
- `src/screens/`, `src/components/`, `src/sheets/`: application UI.
- `src/redux/`: session-only state.
- `src/backend/`: versioned export/import validation and legacy migrations.
- `src/watermelondb/`: legacy SQLite compatibility, not the current data source.

## License

The upstream [BSD 2-Clause license](LICENSE) and attribution are retained. SDK and dependency licenses remain separate.
