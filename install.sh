#!/usr/bin/env bash
set -e

DIFFGUARD_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BIN_DIR="$HOME/.local/bin"
WRAPPER="$BIN_DIR/diffguard"

echo "→ Installing diffguard from $DIFFGUARD_DIR"
cd "$DIFFGUARD_DIR"

# ── 1. Install deps & build ───────────────────────────────────────────────────
echo "→ Installing dependencies..."
npm install --silent

echo "→ Building..."
npm run build

# ── 2. Write wrapper to ~/.local/bin (no sudo needed) ────────────────────────
mkdir -p "$BIN_DIR"

cat > "$WRAPPER" << EOF
#!/usr/bin/env bash
exec node "$DIFFGUARD_DIR/dist/cli.js" "\$@"
EOF

chmod +x "$WRAPPER"
echo "→ Wrapper installed to $WRAPPER"

# ── 3. Ensure ~/.local/bin is on PATH ────────────────────────────────────────
EXPORT_LINE="export PATH=\"\$HOME/.local/bin:\$PATH\""

add_to_rc() {
  local RC="$1"
  if [ -f "$RC" ] && ! grep -qF '.local/bin' "$RC"; then
    echo "" >> "$RC"
    echo "# Added by diffguard install" >> "$RC"
    echo "$EXPORT_LINE" >> "$RC"
    echo "  ✓ Added PATH entry to $RC"
  fi
}

if ! echo "$PATH" | tr ':' '\n' | grep -qxF "$BIN_DIR"; then
  add_to_rc "$HOME/.zshrc"
  add_to_rc "$HOME/.bashrc"
  export PATH="$BIN_DIR:$PATH"
  echo "→ Added $BIN_DIR to PATH"
fi

# ── 4. Verify ─────────────────────────────────────────────────────────────────
if command -v diffguard &>/dev/null; then
  echo ""
  echo "✓ diffguard installed! $(diffguard --version)"
else
  echo ""
  echo "✗ Installed but not on PATH yet. Run:"
  echo "  source ~/.zshrc"
  exit 0
fi

# ── 5. API key reminder ───────────────────────────────────────────────────────
if [ ! -f "$DIFFGUARD_DIR/.env" ]; then
  echo ""
  echo "⚠ No .env found. Create one:"
  echo "  echo 'ANTHROPIC_API_KEY=sk-ant-...' > $DIFFGUARD_DIR/.env"
  echo "  echo 'DIFFGUARD_MODEL=claude-haiku-4-5' >> $DIFFGUARD_DIR/.env"
fi

echo ""
echo "In any project:"
echo "  diffguard init"
echo "  diffguard review"
