// File markers for package manager detection.
export const PACKAGE_MANAGER_LOCKFILES: Array<{ pm: string; files: string[] }> = [
  { pm: "bun", files: ["bun.lockb", "bun.lock"] },
  { pm: "pnpm", files: ["pnpm-lock.yaml"] },
  { pm: "yarn", files: ["yarn.lock"] },
];

// Common package.json script names used as "dev" entry points.
export const DEV_SCRIPT_CANDIDATES = ["dev", "start", "serve"];

// Fallback project detectors used by `siphon dev` when package scripts are missing.
export const FALLBACK_PROJECT_RUNNERS = [
  {
    markerFile: "Cargo.toml",
    message: "[siphon] Detected Cargo project, running: cargo run",
    command: ["cargo", "run"],
  },
  {
    markerFile: "go.mod",
    message: "[siphon] Detected Go project, running: go run .",
    command: ["go", "run", "."],
  },
  {
    markerFile: "manage.py",
    message: "[siphon] Detected Django project, running: python manage.py runserver",
    command: ["python", "manage.py", "runserver"],
  },
];

// Extra hint for Python projects that need manual command selection.
export const PYTHON_PROJECT_MARKER = "pyproject.toml";
export const PYTHON_MANUAL_RUN_HINT =
  "[siphon] Detected Python project. Unable to determine run command.\n" +
  "Try: siphon -- python <your-script>.py";

export const NO_DEV_COMMAND_HINT =
  "[siphon] No dev command detected.\n" +
  "Try adding a 'dev' script to package.json, or use:\n" +
  "  siphon -- <your command>";
