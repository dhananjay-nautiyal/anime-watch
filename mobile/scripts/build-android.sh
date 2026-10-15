#!/usr/bin/env bash
set -euo pipefail

# ================================================================
# AnimeWatch Production Android Build Script
# ================================================================
# Prerequisites:
#   1. Node.js 20+ installed
#   2. EAS CLI installed (npm install -g eas-cli)
#   3. Logged into Expo (eas login)
#   4. EAS project configured (eas init)
#   5. Production credentials set up (eas credentials)
#   6. .env.production with production values
# ================================================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "==> AnimeWatch Production Build"
echo "    Project: $PROJECT_DIR"
echo ""

# Check prerequisites
command -v node >/dev/null 2>&1 || { echo "ERROR: Node.js is required"; exit 1; }
command -v eas >/dev/null 2>&1 || { echo "ERROR: EAS CLI is required. Install: npm install -g eas-cli"; exit 1; }

cd "$PROJECT_DIR"

echo "==> 1. Running TypeScript check..."
npx tsc --noEmit || { echo "ERROR: TypeScript compilation failed"; exit 1; }
echo "    OK"

echo ""
echo "==> 2. Loading production environment..."
if [ -f .env.production ]; then
  set -a
  source .env.production
  set +a
else
  echo "    WARNING: .env.production not found, using defaults"
fi

echo ""
echo "==> 3. Installing dependencies..."
npm ci || { echo "ERROR: npm ci failed"; exit 1; }

echo ""
echo "==> 4. Running Expo prebuild (clean)..."
npx expo prebuild --clean --platform android 2>&1 || echo "    (prebuild warning - may already exist)"

echo ""
echo "==> 5. Building production Android App Bundle..."
echo "    This will upload to EAS and build in the cloud."
echo "    Building for: production channel"
echo ""
eas build --platform android --profile production --non-interactive \
  || { echo "ERROR: EAS build failed"; exit 1; }

echo ""
echo "==> Production build submitted successfully!"
echo "    Monitor progress: eas build:list"
echo ""
echo "==> 6. (Optional) Submit to Play Store"
echo "    Run: eas submit --platform android --profile production"
echo ""

# Extract version from app.json
VERSION=$(node -e "console.log(require('./app.json').expo.version)")
echo "    Version: $VERSION"
echo "    Package: com.animewatch.app"
echo "    Done."
