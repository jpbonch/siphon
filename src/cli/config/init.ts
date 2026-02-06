// Files that strongly indicate a project root.
export const PROJECT_INDICATOR_FILES = [
  "package.json",
  "pyproject.toml",
  "Cargo.toml",
  "go.mod",
  "Makefile",
  "Gemfile",
  "build.gradle",
  "pom.xml",
];

// Fallback source extensions used when project files are missing.
export const SOURCE_FILE_EXTENSIONS = [".js", ".ts", ".py", ".rs", ".go", ".java", ".rb"];

// Guidance appended to agent instruction files.
export const SIPHON_INSTRUCTIONS = `
## Siphon (Runtime Context)

This project uses Siphon to capture runtime output from dev processes.

**Debugging workflow:**
- After ANY code change that could affect runtime behavior, call \`check_status\` to verify it worked
- Do NOT assume a fix worked — always verify with \`check_status\`
- If the user reports something broken, call \`check_status\` BEFORE reading source code
- If \`check_status\` shows no sessions, the dev server may not be running — start it with \`siphon dev\` or the project's dev command

**Running commands:**
- Use \`siphon -- <command>\` to run any command with output capture
- All dev commands in this project are configured to run through siphon
`;
