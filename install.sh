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
  echo ""
  echo "Then re-run: ./install.sh"
  exit 0
fi

# ── 5. Provider & credential setup ───────────────────────────────────────────
ENV_FILE="$DIFFGUARD_DIR/.env"

setup_env() {
  echo ""
  echo "  ── Provider & credential setup ─────────────────────────────────────"
  echo ""
  echo "  Available providers:"
  echo "    1) anthropic  (claude-haiku-4-5  — cheapest, recommended)"
  echo "    2) openai     (gpt-4o-mini       — cheap)"
  echo "    3) gemini     (gemini-2.0-flash  — cheapest)"
  echo "    4) ollama     (local, free       — requires ollama running)"
  echo ""
  read -rp "  Default provider [1-4, default: 1]: " PROVIDER_NUM

  case "$PROVIDER_NUM" in
    2) DEFAULT_PROVIDER="openai"    ;;
    3) DEFAULT_PROVIDER="gemini"    ;;
    4) DEFAULT_PROVIDER="ollama"    ;;
    *) DEFAULT_PROVIDER="anthropic" ;;
  esac

  echo "  → Default: $DEFAULT_PROVIDER"
  echo ""

  # ── API keys ────────────────────────────────────────────────────────────
  KEY_ANTHROPIC=""
  KEY_OPENAI=""
  KEY_GEMINI=""

  prompt_key() {
    local LABEL="$1"
    local REQUIRED="$2"
    local RESULT=""

    if [ "$REQUIRED" = "required" ]; then
      while true; do
        read -rp "  $LABEL API key: " RESULT
        [ -n "$RESULT" ] && break
        echo "  ⚠  Required for default provider. Press Ctrl+C to abort."
      done
    else
      read -rp "  $LABEL API key (Enter to skip): " RESULT
    fi

    printf '%s' "$RESULT"
  }

  if [ "$DEFAULT_PROVIDER" = "ollama" ]; then
    echo "  Ollama: no API key needed — make sure \`ollama serve\` is running."
    echo "  You can still add keys for other providers to use them per-run."
    echo ""
    KEY_ANTHROPIC="$(prompt_key "Anthropic (sk-ant-...)" "optional")"
    KEY_OPENAI="$(prompt_key "OpenAI (sk-...)" "optional")"
    KEY_GEMINI="$(prompt_key "Gemini" "optional")"
  else
    REQ_A="optional"; REQ_O="optional"; REQ_G="optional"
    [ "$DEFAULT_PROVIDER" = "anthropic" ] && REQ_A="required"
    [ "$DEFAULT_PROVIDER" = "openai"    ] && REQ_O="required"
    [ "$DEFAULT_PROVIDER" = "gemini"    ] && REQ_G="required"

    KEY_ANTHROPIC="$(prompt_key "Anthropic (sk-ant-...)" "$REQ_A")"
    KEY_OPENAI="$(prompt_key "OpenAI (sk-...)" "$REQ_O")"
    KEY_GEMINI="$(prompt_key "Gemini" "$REQ_G")"
  fi

  # ── Default model ───────────────────────────────────────────────────────
  echo ""
  echo "  Default model for $DEFAULT_PROVIDER:"

  case "$DEFAULT_PROVIDER" in
    anthropic)
      echo "    1) claude-haiku-4-5   \$1/\$5 per 1M    ← cheapest"
      echo "    2) claude-sonnet-4-6  \$3/\$15 per 1M"
      echo "    3) claude-opus-4-7    \$5/\$25 per 1M   ← best"
      read -rp "  Choose [1-3, default: 1]: " MODEL_NUM
      case "$MODEL_NUM" in
        2) DEFAULT_MODEL="claude-sonnet-4-6" ;;
        3) DEFAULT_MODEL="claude-opus-4-7"   ;;
        *) DEFAULT_MODEL="claude-haiku-4-5"  ;;
      esac
      ;;
    openai)
      echo "    1) gpt-4o-mini  \$0.15/\$0.60 per 1M  ← cheapest"
      echo "    2) gpt-4o       \$2.50/\$10 per 1M"
      echo "    3) gpt-4.1      \$2/\$8 per 1M"
      read -rp "  Choose [1-3, default: 1]: " MODEL_NUM
      case "$MODEL_NUM" in
        2) DEFAULT_MODEL="gpt-4o"      ;;
        3) DEFAULT_MODEL="gpt-4.1"     ;;
        *) DEFAULT_MODEL="gpt-4o-mini" ;;
      esac
      ;;
    gemini)
      echo "    1) gemini-2.0-flash  \$0.10/\$0.40 per 1M  ← cheapest"
      echo "    2) gemini-1.5-pro    \$1.25/\$5 per 1M"
      read -rp "  Choose [1-2, default: 1]: " MODEL_NUM
      case "$MODEL_NUM" in
        2) DEFAULT_MODEL="gemini-1.5-pro"   ;;
        *) DEFAULT_MODEL="gemini-2.0-flash" ;;
      esac
      ;;
    ollama)
      echo "    Common: llama3.2, qwen2.5-coder, mistral, codellama"
      read -rp "  Model name [default: llama3.2]: " OLLAMA_MODEL
      DEFAULT_MODEL="${OLLAMA_MODEL:-llama3.2}"
      ;;
  esac

  echo "  → Model: $DEFAULT_MODEL"

  # ── Write .env ──────────────────────────────────────────────────────────
  {
    echo "# Generated by diffguard install — $(date)"
    echo ""
    echo "# Provider: anthropic | openai | gemini | ollama"
    echo "DIFFGUARD_PROVIDER=$DEFAULT_PROVIDER"
    echo ""
    echo "# API keys"
    if [ -n "$KEY_ANTHROPIC" ]; then
      echo "ANTHROPIC_API_KEY=$KEY_ANTHROPIC"
    else
      echo "# ANTHROPIC_API_KEY="
    fi
    if [ -n "$KEY_OPENAI" ]; then
      echo "OPENAI_API_KEY=$KEY_OPENAI"
    else
      echo "# OPENAI_API_KEY="
    fi
    if [ -n "$KEY_GEMINI" ]; then
      echo "GEMINI_API_KEY=$KEY_GEMINI"
    else
      echo "# GEMINI_API_KEY="
    fi
    echo ""
    echo "# Model override (leave unset to auto-select by provider + mode)"
    echo "DIFFGUARD_MODEL=$DEFAULT_MODEL"
    echo ""
    echo "# Budget limits (optional)"
    echo "DIFFGUARD_MAX_REVIEW_COST_USD=0.10"
    echo "DIFFGUARD_MAX_SESSION_COST_USD=2.00"
    echo ""
    echo "# Ollama base URL (optional, default: http://localhost:11434)"
    echo "# OLLAMA_BASE_URL=http://localhost:11434"
  } > "$ENV_FILE"

  echo ""
  echo "  ✓ Saved to $ENV_FILE"
}

if [ -f "$ENV_FILE" ]; then
  echo ""
  read -rp "  .env already configured. Reconfigure credentials? (y/N): " RECONFIGURE
  case "$RECONFIGURE" in
    [yY]*) setup_env ;;
    *)     echo "  → Keeping existing .env" ;;
  esac
else
  setup_env
fi

echo ""
echo "  Done! In any project:"
echo "    diffguard init     ← run once per project"
echo "    diffguard review   ← review current branch"
