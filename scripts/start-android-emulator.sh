#!/usr/bin/env bash
set -euo pipefail

# Tested on this laptop's AMD Radeon 610M, using emulator 37.1.11.
# Cold boot preserves installed apps/data; it only avoids Quick Boot snapshots.
sdk_dir="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-${HOME}/Android/Sdk}}"
avd_name="${1:-Pixel_7a}"
dry_run=false
if [[ "$avd_name" == "--dry-run" ]]; then
  dry_run=true
  avd_name="Pixel_7a"
fi

emulator_bin="$sdk_dir/emulator/emulator"
adb_bin="$sdk_dir/platform-tools/adb"
if [[ ! -x "$emulator_bin" ]]; then
  printf 'Android emulator not found at %s. Set ANDROID_HOME to your SDK.\n' "$emulator_bin" >&2
  exit 1
fi

args=(-avd "$avd_name" -gpu host -feature -Vulkan -no-snapshot
  -no-boot-anim -cores 2 -camera-back none -camera-front none)

if [[ "$dry_run" == true ]]; then
  printf 'QT_QPA_PLATFORM=xcb '
  printf '%q ' "$emulator_bin" "${args[@]}"
  printf '\n'
  exit 0
fi

if [[ -x "$adb_bin" ]]; then
  while read -r serial state remainder; do
    if [[ "$serial" == emulator-* && "$state" == device ]]; then
      running_name=$("$adb_bin" -s "$serial" emu avd name 2>/dev/null | head -n 1 | tr -d '\r' || true)
      if [[ "$running_name" == "$avd_name" ]]; then
        printf '%s is already running (%s). Use its existing window.\n' "$avd_name" "$serial"
        exit 0
      fi
    fi
  done < <("$adb_bin" devices)
fi

# Process-local X11/XWayland selection; does not change the desktop session.
export QT_QPA_PLATFORM=xcb
exec "$emulator_bin" "${args[@]}"
