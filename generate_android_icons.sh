#!/bin/bash
# GNote Android Launcher Icons Generator
# Uses macOS built-in sips tool for high-quality resizing

SRC="public/icons/icon-512.png"
RES_DIR="android/app/src/main/res"

if [ ! -f "$SRC" ]; then
  echo "Error: Source icon $SRC not found!"
  exit 1
fi

echo "=== Generating Android Legacy and Adaptive Launcher Icons ==="

# 1. mipmap-mdpi (Legacy: 48x48, Foreground: 108x108)
echo "Generating mdpi icons..."
sips -z 48 48 "$SRC" --out "$RES_DIR/mipmap-mdpi/ic_launcher.png" >/dev/null
sips -z 48 48 "$SRC" --out "$RES_DIR/mipmap-mdpi/ic_launcher_round.png" >/dev/null
sips -z 108 108 "$SRC" --out "$RES_DIR/mipmap-mdpi/ic_launcher_foreground.png" >/dev/null

# 2. mipmap-hdpi (Legacy: 72x72, Foreground: 162x162)
echo "Generating hdpi icons..."
sips -z 72 72 "$SRC" --out "$RES_DIR/mipmap-hdpi/ic_launcher.png" >/dev/null
sips -z 72 72 "$SRC" --out "$RES_DIR/mipmap-hdpi/ic_launcher_round.png" >/dev/null
sips -z 162 162 "$SRC" --out "$RES_DIR/mipmap-hdpi/ic_launcher_foreground.png" >/dev/null

# 3. mipmap-xhdpi (Legacy: 96x96, Foreground: 216x216)
echo "Generating xhdpi icons..."
sips -z 96 96 "$SRC" --out "$RES_DIR/mipmap-xhdpi/ic_launcher.png" >/dev/null
sips -z 96 96 "$SRC" --out "$RES_DIR/mipmap-xhdpi/ic_launcher_round.png" >/dev/null
sips -z 216 216 "$SRC" --out "$RES_DIR/mipmap-xhdpi/ic_launcher_foreground.png" >/dev/null

# 4. mipmap-xxhdpi (Legacy: 144x144, Foreground: 324x324)
echo "Generating xxhdpi icons..."
sips -z 144 144 "$SRC" --out "$RES_DIR/mipmap-xxhdpi/ic_launcher.png" >/dev/null
sips -z 144 144 "$SRC" --out "$RES_DIR/mipmap-xxhdpi/ic_launcher_round.png" >/dev/null
sips -z 324 324 "$SRC" --out "$RES_DIR/mipmap-xxhdpi/ic_launcher_foreground.png" >/dev/null

# 5. mipmap-xxxhdpi (Legacy: 192x192, Foreground: 432x432)
echo "Generating xxxhdpi icons..."
sips -z 192 192 "$SRC" --out "$RES_DIR/mipmap-xxxhdpi/ic_launcher.png" >/dev/null
sips -z 192 192 "$SRC" --out "$RES_DIR/mipmap-xxxhdpi/ic_launcher_round.png" >/dev/null
sips -z 432 432 "$SRC" --out "$RES_DIR/mipmap-xxxhdpi/ic_launcher_foreground.png" >/dev/null

echo "=== All Android Launcher Icons generated successfully! ==="
