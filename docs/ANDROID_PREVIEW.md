# Test Zero locally on Android

Zero is a bare React Native app, not an Expo project. Its native Google Sign-In,
Keychain, MMKV, and legacy database modules are not available in Expo Go. Do not
run `expo prebuild` on this repository just to preview it: that is a separate
native-project migration. Expo development builds are an option for a future
integration, but are not needed for the existing Android workflow.

## Preview from Codex on this laptop

Verified September 4, 2026: the x86_64 debug APK built successfully and installed
on the existing Pixel 7a API 36 emulator. SDK licenses were accepted with the
owner's authorization. On this laptop `android/local.properties` points Gradle
to the SDK; this machine-specific file is intentionally ignored by Git.

Open the terminal button in Codex (or press Ctrl + backtick). The terminal can
run the app, but the Android UI appears in the emulator's own window. This
project has no web target to open in Codex's browser panel.

1. Start the emulator with the stable profile verified on this laptop:

   ```bash
   cd /home/saad/Desktop/projects/zero
   npm run android:emulator
   ```

   Wait until Android's home screen appears. Do not launch another copy if it
   is already running.

2. In a project terminal, start Metro and leave it running:

   ```bash
   cd /home/saad/Desktop/projects/zero
   npm start -- --host 127.0.0.1 --max-workers 2
   ```

3. In another terminal, install and launch the debug app:

   ```bash
   cd /home/saad/Desktop/projects/zero
   export ANDROID_HOME=/home/saad/Android/Sdk
   export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"
   npm run android -- --active-arch-only --no-packager --extra-params="--max-workers=2"
   ```

   `--active-arch-only` compiles for the connected device instead of all four
   architectures. Keep only the intended emulator/phone connected, or use
   `--list-devices` to choose one.

4. Use **Continue with Google** in Zero. Enter credentials directly on the
   emulator/phone, never in chat. Google Play Services and a matching Android
   OAuth registration are required; see `supabase-storage.md` for the package
   and signing fingerprint.

5. Keep Metro running while changing TypeScript/React UI code. Fast Refresh
   applies most changes automatically. Press **r** in Metro to reload. Native
   dependency or Android configuration changes require step 3 again.

## Emulator stability fix on this laptop

On September 4, the owner confirmed that the emulator responded normally after
upgrading from 36.4.9 to stable 37.1.11 and using hardware OpenGL, Vulkan disabled,
a cold boot, two CPU cores, and disabled simulated cameras. Android Settings
navigation also succeeded. The previous automatic renderer used software
rendering; memory pressure from idle build daemons was an additional concern.
This is a verified working configuration, not proof of one specific root cause
or a guarantee against all future hangs.

`npm run android:emulator` reapplies the tested flags and selects X11/XWayland
only for that process. `npm run android:emulator -- --dry-run` prints the command
without launching anything. The launcher detects an already-running AVD.

The Pixel 7a settings in `/home/saad/.android/avd/Pixel_7a.avd/config.ini` also
persist hardware rendering, cold boot, two cores, and disabled cameras for Device
Manager launches. `/home/saad/.android/advancedFeatures.ini` disables Vulkan for
**all emulators launched by this Linux user**. Prefer the project launcher to
also apply the tested Qt platform and no-snapshot flags.

No installed apps, accounts, or emulator user data were erased. Cold boot skips
saved runtime snapshots, not app storage. The original AVD configuration is at
`/home/saad/Android/emulator-fix.CK1GAe/Pixel_7a-config-before.ini`, and the old
emulator binary directory is preserved alongside it as `emulator-36.4.9`.
To roll back, first close the emulator, restore the saved AVD configuration,
remove the added `Vulkan = off` override, and swap the preserved emulator
directory back into the SDK while keeping the current directory as a backup.
No rollback requires wiping the virtual device.

After a build finishes, `cd android && ./gradlew --stop` can release idle Gradle
daemon memory; do not do this while a build is running.

## Use a physical Android phone instead

1. Enable Developer options (usually tap Build number seven times), then enable
   USB debugging.
2. Connect by USB and accept the debugging authorization on the phone.
3. Run `adb devices`: the phone must show `device`, not `unauthorized`.
4. Run `adb reverse tcp:8081 tcp:8081`, then follow steps 2–5 above, with the
   emulator closed. USB reverse allows the phone to reach Metro without Wi-Fi
   setup. Never use `adb uninstall` or clear app data just to update the build.

## What to test

- Login, add/edit spending, and restart the app to verify confirmed saves.
- Weekly/monthly limits, category progress, hide/show setting, and full dates.
- Investing and Trading are intentionally placeholder pages.
- Sign-out and sign-in again should restore the same cloud data.
- Reinstall recovery is a separate destructive test: only do it after confirming
  the data exists in the cloud, ideally with a manual JSON export. Signing back
  into the same Google account should restore confirmed records.

Debug APKs need Metro for JavaScript; an APK copied to a phone is not automatically
a standalone release. Keep release signing and standalone packaging separate
from this live-preview workflow.

## Official references

- [Codex integrated terminal](https://learn.chatgpt.com/docs/integrated-terminal)
- [React Native: running on a device](https://reactnative.dev/docs/running-on-device)
- [Expo: custom native code and development builds](https://docs.expo.dev/workflow/customizing/)
- [Android SDK package manager](https://developer.android.com/tools/sdkmanager)
- [Android emulator troubleshooting](https://developer.android.com/studio/run/emulator-troubleshooting)
- [Android emulator release notes](https://developer.android.com/studio/releases/emulator)
