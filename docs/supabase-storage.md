# Android cloud storage

This fork targets Android for private use; no store deployment is planned.

## Current configuration

The public project URL, publishable key, and Google web OAuth client ID are in
`src/config/supabase.ts`. Never add a service-role key, database password, or
Google client secret to the mobile app. The Google client secret belongs in
Supabase's Google provider configuration.

Project: `wdsdcoumuawvfstyspbw`. Google provider and the `zero_cloud_records`
migration were verified live. No paid branch, service, or billing change was made.

Google native Android sign-in also needs an Android OAuth client for package
`com.anotherwhy.zero` and the SHA-1 fingerprint of the key that signs the APK.
The checked-in development keystore SHA-1 is
`5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25`.
Register the debug fingerprint for development and the release fingerprint for
private release APKs. This cannot be inferred from the web client ID. Google
Play Services must be available on the device. See
[Supabase Google sign-in](https://supabase.com/docs/guides/auth/social-login/auth-google).

### Android login failure: unregistered application / code 10

On September 4, 2026, device logs reported that the Android application was not
registered for OAuth2 and instructed checking the package and signing SHA-1.
The built debug APK's certificate was reverified against the fingerprint above.
The public Supabase auth settings endpoint returned HTTP 200 with Google enabled
and signup allowed; no auth/gateway log entries were returned for the failed
attempt window (15:45–16:10 UTC). The failure occurs at native Google sign-in,
before the app can exchange an ID token for a Supabase session.

Google Cloud inspection then confirmed two independent mismatches in project
`opinex-453609` (display name `General`):

- The supplied client `603085813837-uhun11egqut19ddr0di4jgedmqpcvl0l.apps.googleusercontent.com`
  is **Android**, named `Zero_Tracker`, despite being used as `GOOGLE_WEB_CLIENT_ID`.
- That client's package was `com.zero-tracker` and its SHA-1 was
  `BB:9A:2A:37:E6:F1:9B:DD:B9:5E:BA:CC:F6:C1:68:48:1F:1B:92:C8`.
  Neither matches the installed debug build. The unrelated `Nuqta App` Web
  client must not be repurposed for Zero.

With the owner's approval, the following changes were made in
[Google Auth Platform → Clients](https://console.cloud.google.com/auth/clients?project=opinex-453609):

1. Zero's **Android** OAuth registration was saved with package `com.anotherwhy.zero`
   and SHA-1 `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25`.
   The previous values above are retained for rollback.
2. A dedicated **Web application** client named `Zero Supabase Web` was created:
   `603085813837-33q4qlf10pd6cmm2viot7bruna40f706.apps.googleusercontent.com`.
   Its authorized redirect is `https://wdsdcoumuawvfstyspbw.supabase.co/auth/v1/callback`.
   The app now uses this Web client ID. The unrelated `Nuqta App` was untouched.
3. Supabase's Google provider was saved with the Web client ID first, followed
   by Zero's Android client ID, and the matching Web client secret. Nonce checks
   remain enabled and email remains required. The secret is not in the app or
   repository. Reopening the provider confirmed the saved client list; a live
   authorization request returned HTTP 302 to Google with the new Web client ID
   and the expected Supabase callback.
4. Retry **Continue with Google** after Google's configuration propagates. If a
   separate consent/audience error appears, review Google Auth Platform's Audience
   settings and the account allowed to test the app.

This repair concerns OAuth registration, not Drive storage or database access.
Do not enable Drive APIs, start a billing trial, change RLS, or rotate signing
keys as a workaround. No Firebase configuration file is required for this
non-Firebase integration. See the library's
[setup guide](https://react-native-google-signin.github.io/docs/setting-up/android)
and [configuration troubleshooting](https://react-native-google-signin.github.io/docs/troubleshooting).

The app now distinguishes Android configuration, connectivity, Play Services,
missing-token, and cloud-session errors without displaying raw provider details.
Focused auth tests verify error handling, privacy, cancellation, and retry.
The 16 focused auth tests, TypeScript, lint, and formatting checks passed after
the client-ID correction. A real successful device sign-in still needs owner
verification; mocked auth tests and an authorization redirect do not prove
end-to-end login.

## Storage and lifecycle

- Google ID tokens are exchanged for a Supabase session. Signup and returning
  login use the same button. Signing into the same Google identity after
  reinstalling loads the same Supabase account.
- Financial records are separate JSONB rows in `zero_records`, owned by the
  authenticated user's UUID. `zero_accounts` stores the account revision.
- Both tables have owner-only RLS and no anonymous access. RPCs run as the
  caller, not as a privileged definer. Never use client-editable metadata to
  decide authorization.
- `zero_read` returns an atomic snapshot, avoiding the default table row limit.
  Concurrent reads are coalesced in RAM, not persisted. It reads the entire
  account, appropriate for the current personal tracker; server-side filtered
  reads may be needed for very large histories.
- Each save calculates a changed-record batch and submits it with the snapshot
  revision. Conflicts re-read and recompute, up to three attempts. Related
  deletions, imports, and budget changes commit in one server transaction.
- Internet is required. A failed/unknown response is not reported as saved.
  There is no persistent offline write queue. If the app is killed or the
  network fails after a server commit but before its acknowledgement, reopen
  and check the records before retrying an addition.
- Financial screens use RAM-only Redux. Auth credentials use Android-backed
  Keychain storage. MMKV retains display/tutorial preferences, not transactions.
  Expense-year caches and diagnostics are RAM-only. Signing out clears them
  and rejects outstanding old-account responses.
- Explicit JSON/CSV exports still write files at the user's request. Those
  files are outside automatic app storage and must be protected by the user.
- This is cloud persistence, not an independent backup of deleted records.
  Deleting cloud records cannot be undone through reinstall. Manual JSON
  export remains available before destructive actions.

## Existing device data

An installation with the legacy onboarding marker is offered a move before
opening financial screens. It must confirm the destination Google account.
The legacy SQLite database is not used for any new financial writes.

The move preserves IDs through a deterministic `sqlite:` namespace, relationships,
soft-delete status, transactions, and budgets. A cloud receipt makes retrying
an interrupted move idempotent. Every migrated record's fields and the currency
are verified before the original SQLite database is reset. The old copy stays
untouched on upload/verification failure. Different-currency or ambiguous-owner
merges are blocked. A changed local copy with an existing receipt is preserved
for manual resolution, not overwritten or discarded.

After a successful move the reset database is empty and future launches do not
open it. The old database code remains only for migration and compatibility
tests. Do not remove it until all legacy installations have migrated.

Rollback: before local cleanup, the previous build can still read SQLite.
After cleanup, export JSON from the cloud before returning to an old build;
the old build cannot read Supabase directly. Do not roll back the schema by
dropping live tables with user records.

## Verification

Run `npm run test:cloud-db`, `npm test -- --runInBand`, `npx tsc --noEmit`, and
`npx eslint . --quiet`. The database tests use ephemeral Postgres (PGlite), not
real user accounts. Live isolation/CAS tests were also run in a transaction and
rolled back. Supabase's security advisor returned no findings.

Android-device checks still required: real Google login/cancel, cold launch,
save/edit/delete, offline retry, account switching, uninstall/reinstall restore,
and verified legacy migration. A JS bundle or mocked auth test does not prove
the Android OAuth registration or secure-storage integration works on-device.

The Android SDK/NDK license blocker was resolved on September 4, 2026 with the
owner's explicit authorization. This laptop now has NDK `28.0.12916984`
(r28 beta 3, the project's existing pin), SDK Platform 36, Build Tools 36.0.0,
and CMake 3.30.5. The downloaded NDK archive matched Google's repository checksum.
See [Android preview steps](ANDROID_PREVIEW.md) to run the emulator or a USB
phone. The project's BSD-2-Clause license remains intact; it does not replace
Android SDK/NDK terms. Actual Google login and persistence still need device QA.
