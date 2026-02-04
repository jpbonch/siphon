# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build Commands

```bash
bun run build    # Compiles both binaries to dist/
```

This produces two compiled executables:
- `dist/siphon` - CLI tool
- `dist/siphon-mcp` - MCP server

## Architecture

Siphon captures command output to log files in `~/.siphon/`, making them accessible via MCP.

**siphon CLI** (`src/siphon.ts`): Wraps any command, passing through stdin while tee-ing stdout/stderr to `~/.siphon/<dirname>.log`. If the log file exists, appends a numeric suffix.

**siphon MCP server** (`src/siphon-mcp.ts`): Exposes two tools:
- `list_sessions` - Lists all `.log` files in `~/.siphon/`
- `get_output` - Returns the last N lines from a session log using `tail`
