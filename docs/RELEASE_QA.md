# Android verification checklist

This fork is for private Android use. No iOS or app-store release is currently planned. Do not treat unit tests or a JavaScript bundle as an Android-device sign-off.

## Automated checks

```bash
npx tsc --noEmit
npx eslint . --quiet
npm test -- --runInBand
npm run test:cloud-db
bun test
cd android && ./gradlew assembleDebug --console=plain
```

## Authentication and privacy

- [x] Register package `com.anotherwhy.zero` and the APK signing SHA-1 in a Google Android OAuth client.
- [ ] Fresh install displays Google login, not financial screens.
- [ ] Google login/cancel/error, then successful retry.
- [ ] Cold start restores the securely stored session and fetches the same account.
- [ ] Switching accounts never shows old transactions, budgets, names, or debts.
- [ ] Sign-out during a request cannot deliver old data to the next account.
- [ ] New installations contain no financial SQLite/MMKV records or persistent diagnostics.
- [ ] Only explicit exports write financial files to device storage.
- [ ] Settings About contains only Version; no Drive controls remain.

## Persistence and recovery

- [ ] Add/edit/delete expense, category, debtor, debt, weekly and monthly limits.
- [ ] Save buttons resist rapid double taps and show a failure when offline.
- [ ] On an ambiguous timeout, reload before retrying an addition.
- [ ] Uninstall/reinstall, Google sign-in: recover previously confirmed cloud records.
- [ ] Airplane mode at cold launch: retry screen, not an empty account or false success.
- [ ] Two devices make concurrent edits without silently overwriting unrelated records.
- [ ] Old SQLite installation requires explicit destination-account confirmation.
- [ ] Failed migration upload/verification preserves SQLite; retry does not duplicate records.
- [ ] A different-currency migration is blocked without deleting the device copy.
- [ ] JSON import/export round trip preserves budgets, relationships, and soft deletes.
- [ ] Cancel cloud-replace/delete confirmation: no data changes.
- [ ] Delete-with-export failure aborts deletion. Confirmed deletion affects only the signed-in account.
- [ ] Delayed transaction delete/undo, recycling, and logout remain account-bound; failed delete is recoverable on refresh.

## Existing product features

- [ ] Overall and category monthly/weekly progress totals are accurate.
- [ ] A week crossing month/year boundaries includes all its spending.
- [ ] Sunday/Monday week-start choice is respected.
- [ ] Home progress visibility, theme, and locale reload from the cloud account.
- [ ] Spending group labels show weekday and date.
- [ ] Investing and Trading tabs remain placeholders.
- [ ] Reports, backdated entries, large fonts, and accessibility labels are usable.

## Current evidence and remaining gate

September 4, 2026: TypeScript and ESLint checks passed; Jest passed 264 tests
across 23 suites; Bun's overlapping pure-logic subset passed 217 tests. The
database harness passed owner isolation, anonymous denial, conflict detection,
atomic rollback, deletion scope, and restoration beyond 1,000 records. A
production-mode Android JavaScript bundle with assets built successfully.

See [cloud storage notes](supabase-storage.md) for automated and live database checks.
The SDK license blocker was resolved with the owner's authorization on September
4, 2026. The exact pinned NDK, SDK Platform 36, Build Tools 36.0.0, and CMake
3.30.5 are installed; Gradle also installed dependency-required Build Tools
35.0.0 and CMake 3.22.1. After retrying a temporary DNS failure, the x86_64
debug build succeeded (607 tasks) and installed on the Pixel 7a API 36 emulator.
The APK's debug signing SHA-1 matches the OAuth setup notes. This verifies the
native build and installation, not Google authentication or financial flows.
Those still require signed-in device QA.
The emulator was updated to stable 37.1.11; hardware OpenGL with Vulkan disabled,
cold boot, two cores, and disabled simulated cameras restored responsiveness
confirmed by the owner. Android Settings navigation succeeded. The working
profile is saved locally and in the `android:emulator` launcher; shell syntax,
dry-run flags, and duplicate-instance detection were checked. No emulator user
data was wiped. This does not substitute for the signed-in app checks above.
See [live preview instructions](ANDROID_PREVIEW.md).
