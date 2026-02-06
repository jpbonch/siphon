# siphon

Runtime context for coding agents. Captures dev server output so AI assistants can see errors, logs, and build results.

## Why?

When you run `npm run dev`, the output stays in your terminal. Your AI assistant (Claude Code, Cursor, etc.) can't see it. When something breaks, the AI has to guess or ask you to copy-paste errors.

Siphon captures that output and exposes it via MCP, so your AI can:
- See errors immediately after code changes
- Check if a fix actually worked
- Understand what's happening at runtime

## Quick Start

```bash
# Install globally
npm install -g siphon-dev

# Set up siphon in your project
cd your-project
siphon init

# Run your dev server through siphon
siphon -- npm run dev
```

## Usage

### Wrap any command

```bash
siphon -- npm run dev
siphon -- python manage.py runserver
siphon -- cargo run
```

### Auto-detect and run dev command

```bash
siphon dev
```

### Initialize project (recommended)

```bash
siphon init
```

This will:
1. Wrap your `dev` script in package.json with siphon
2. Configure MCP for Claude Code and/or Cursor
3. Add debugging instructions to CLAUDE.md or .cursorrules

### Authenticate for production context

`check_status` can return an authentication link when production context is
available but not yet connected. The user clicks that link, authenticates in a
browser tab, then the agent calls `check_status` again to verify connection and
fetch production service/process status.

### View sessions

```bash
siphon list
```

### Clean old logs

```bash
siphon clean           # Remove logs older than 7 days
siphon clean --days 1  # Remove logs older than 1 day
siphon clean --all     # Remove all logs
```

## MCP Tools

Once configured, your AI assistant has access to:

### `check_status`

Quick health check across local dev processes and (when authenticated) production services. Shows:
- Running/crashed local processes
- Production service/process status and team context
- Recent errors with stack traces
- Hints for fixing issues

### `get_output`

Get raw log output from a session. Use for deeper investigation when `check_status` isn't enough.

## How It Works

1. `siphon -- <command>` runs your command and tees output to `~/.siphon/<session>.log`
2. Siphon monitors the log for errors, ports, and success patterns
3. The MCP server (`siphon-mcp`) exposes this data to AI assistants
4. Your AI calls `check_status` to see what's happening

## Features

- **Error detection** - Recognizes JS/Python/Go/Rust errors and stack traces
- **Success detection** - Resets error state when builds succeed (hot reload friendly)
- **Port detection** - Tracks which port your dev server is running on
- **Log capping** - Prevents runaway log files (capped at 1MB)
- **ANSI stripping** - Clean text for AI consumption
- **Uncaptured process detection** - Alerts when dev servers are running without siphon

## Requirements

- Node.js 18+
- For Claude Code: Claude Code CLI installed
- For Cursor: Cursor IDE with MCP support

## License

BSL-1.1 (Business Source License)
