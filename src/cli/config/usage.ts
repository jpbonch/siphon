// Keep CLI usage text in one editable module.
export const CLI_USAGE_TEXT = `siphon - Runtime context for coding agents

Usage:
  siphon -- <command> [args...]   Wrap a command and capture output
  siphon init [options]            Set up siphon for this project
  siphon dev                       Run the project's dev command via siphon
  siphon login                     Save API key for production status context
  siphon logout                    Remove saved API key from local config
  siphon list                      Show active/recent sessions
  siphon clean [--days N] [--all]  Remove old log files

Options:
  --name <name>   Override the session name (use with --)
  --help          Show this help message

Init options:
  --yes, -y                     Auto-confirm all prompts (non-interactive)
  --agent claude|cursor|both    Specify which agent to configure

Examples:
  siphon -- npm run dev
  siphon --name my-app:frontend -- npm run dev
  siphon init
  siphon init --yes --agent claude
  siphon dev
  siphon login
  siphon logout
`;
