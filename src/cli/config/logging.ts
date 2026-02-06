// Poll cadence for background log parsing while a command is running.
export const LOG_MONITOR_INTERVAL_MS = 2000;

// Hard cap and truncate target for session log files.
export const MAX_LOG_SIZE_BYTES = 1024 * 1024;
export const TRUNCATE_TO_SIZE_BYTES = 512 * 1024;
