// Centralized MCP tool descriptions and reusable user-facing text.

export const CHECK_STATUS_TOOL_DESCRIPTION = `Quick health check across local dev processes and production services.
Returns what's running, what's crashed, and recent errors with stack traces.

CALL THIS TOOL:
- After making code changes to verify they worked
- When the user says something is "broken", "not working", or "crashing"
- Before investigating any runtime issue
- When starting a debugging task to understand current state
- After a previous fix attempt to confirm it resolved the issue

PRODUCTION CONTEXT:
If authenticated, this tool also returns production errors from connected
services (Sentry, Datadog, etc.) and team context.

If the response includes an authentication link, share it with the user.
After they click it and authenticate, call check_status again to verify
connection and fetch production context.

If this tool reports that siphon is not set up for local monitoring, run
the provided setup command to enable automatic runtime monitoring.`;

export const GET_OUTPUT_TOOL_DESCRIPTION = `Get raw log output from a siphon session. Use when check_status doesn't
provide enough detail — for example, to see the full sequence of events
leading to an error, to search for specific output, or to see non-error
output like build results.

Usually check_status is sufficient. Use this for deeper investigation.`;
