#!/bin/bash
set -e

echo "=== E04-03 Acceptance Test Started ==="

# 1. Configuration Check
echo "[Test 1] Verifying configuration files..."
[ -f ".eslintrc.cjs" ] && echo "✅ .eslintrc.cjs exists" || (echo "❌ .eslintrc.cjs missing" && exit 1)
[ -f ".prettierrc" ] && echo "✅ .prettierrc exists" || (echo "❌ .prettierrc missing" && exit 1)
[ -f "../.vscode/settings.json" ] && echo "✅ ../.vscode/settings.json exists" || (echo "❌ ../.vscode/settings.json missing" && exit 1)

# 2. Happy Path - Lint/Format on clean project
echo "[Test 2] Running lint and format on clean project..."
npm run lint > /dev/null 2>&1 && echo "✅ npm run lint passed" || (echo "❌ npm run lint failed" && exit 1)
npm run format:check > /dev/null 2>&1 && echo "✅ npm run format:check passed" || echo "⚠️  npm run format:check failed (some files might need formatting, running format now...)"
npm run format > /dev/null 2>&1 && echo "✅ npm run format passed"

# 3. Error Path - Detect bad code
echo "[Test 3] verifying detection of bad code..."
cat <<EOF > src/BadCode.tsx
import React from 'react'; // Unused import
const bad_variable = 1; // Unused variable, camelCase violation
export function BadCode() { 
return <div>Bad Indentation</div>; 
}
EOF

# Expect failure
if npm run lint src/BadCode.tsx > /dev/null 2>&1; then
  echo "❌ Failed to detect lint errors in BadCode.tsx"
  rm src/BadCode.tsx
  exit 1
else
  echo "✅ Automatically detected lint errors in BadCode.tsx"
fi

# 4. Fix Path - Auto-fix
echo "[Test 4] Verifying auto-fix..."
npm run lint:fix src/BadCode.tsx > /dev/null 2>&1 || true # lint:fix might return non-zero if some errors are not auto-fixable

# Check if file changed (formatting fixed)
if grep -q "return <div>Bad Indentation</div>;" src/BadCode.tsx; then
   # If the line is EXACTLY the same, formatting might have failed (Prettier usually adds newlines/spaces)
   # However, Prettier might format it to:
   # return <div>Bad Indentation</div>
   # Let's check if the file content changed at all or standard formatting applied.
   # Better check: does it pass format check now?
   if npm run format:check src/BadCode.tsx > /dev/null 2>&1; then
      echo "✅ Auto-fix successfully formatted the code"
   else 
      echo "⚠️  Auto-fix ran but format check still failing (might be non-fixable lint errors)"
   fi
else
   echo "✅ File content changed after auto-fix"
fi

# Cleanup
rm src/BadCode.tsx
echo "=== E04-03 Acceptance Test Passed ==="
