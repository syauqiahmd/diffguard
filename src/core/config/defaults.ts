export const DEFAULT_CONFIG_YAML = `version: 1

review:
  mode: balanced
  provider: anthropic
  model: claude-sonnet-4-6

rules:
  max_complexity: 15
  forbidden:
    - console.log
    - debugger
    - TODO
    - FIXME
  required:
    - validation

architecture:
  no_direct_db_access: true
  controller_must_not_contain_business_logic: true

ignore:
  - dist/
  - coverage/
  - node_modules/
  - .git/
  - "*.min.js"
  - "*.lock"
`;
