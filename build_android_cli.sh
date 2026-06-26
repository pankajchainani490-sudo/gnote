#!/bin/bash
# NoteFlow Android CLI build helper script (No Android Studio required)

echo "=== NoteFlow Android CLI Builder ==="

# 1. Determine Homebrew SDK Path based on directory existence
BREW_SDK_PATH=""
POSSIBLE_PATHS=(
  "/opt/homebrew/share/android-commandlinetools"
  "/opt/homebrew/share/android-sdk"
  "/usr/local/share/android-commandlinetools"
  "/usr/local/share/android-sdk"
  "$HOME/Library/Android/sdk"
)

for p in "${POSSIBLE_PATHS[@]}"; do
  if [ -d "$p" ]; then
    BREW_SDK_PATH="$p"
    break
  fi
done

# 2. Check if Android SDK CLI tools are found
if [ -z "$BREW_SDK_PATH" ]; then
  echo "Android SDK not found."
  echo "To build without Android Studio, please install the Android CLI Tools via Homebrew:"
  echo "  brew install --cask android-commandlinetools"
  echo ""
  echo "After installing, please run this script again."
  exit 1
fi

echo "Found Android SDK at $BREW_SDK_PATH"

# 3. Write local.properties automatically
echo "Configuring android/local.properties..."
echo "sdk.dir=$BREW_SDK_PATH" > android/local.properties

# 4. Accept licenses
SDK_MANAGER_PATH="$BREW_SDK_PATH/cmdline-tools/latest/bin/sdkmanager"
if [ -f "$SDK_MANAGER_PATH" ]; then
  echo "Accepting Android SDK licenses..."
  yes | "$SDK_MANAGER_PATH" --licenses &> /dev/null
elif command -v sdkmanager &> /dev/null; then
  echo "Accepting Android SDK licenses..."
  yes | sdkmanager --licenses &> /dev/null
fi

# 5. Build the APK using Gradle
echo "Syncing frontend assets and compiling Android APK..."
npm run android:sync

echo "Compiling native debug APK..."
cd android && ./gradlew assembleDebug

if [ $? -eq 0 ]; then
  echo ""
  echo "=== Build Succeeded! ==="
  echo "Your Android APK is ready at:"
  echo "android/app/build/outputs/apk/debug/app-debug.apk"
else
  echo ""
  echo "=== Build Failed ==="
  echo "Please check the logs above."
fi
