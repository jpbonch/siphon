import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { DEV_SCRIPT_CANDIDATES, PACKAGE_MANAGER_LOCKFILES } from "../config/dev";
import type { DevScriptInfo } from "../types";

interface PackageJsonShape {
  scripts?: Record<string, string>;
}

// Detect package manager by lockfiles in project root.
export function detectPackageManager(cwd: string): string {
  for (const candidate of PACKAGE_MANAGER_LOCKFILES) {
    if (candidate.files.some((file) => existsSync(join(cwd, file)))) {
      return candidate.pm;
    }
  }

  return "npm";
}

// Locate first available dev-like script from package.json.
export function detectDevScript(cwd: string): DevScriptInfo | null {
  const pkgPath = join(cwd, "package.json");
  if (!existsSync(pkgPath)) {
    return null;
  }

  try {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as PackageJsonShape;
    const scripts = pkg.scripts ?? {};
    const pm = detectPackageManager(cwd);

    for (const script of DEV_SCRIPT_CANDIDATES) {
      if (scripts[script]) {
        return { pm, script };
      }
    }
  } catch {
    // Invalid package.json should not crash CLI commands.
  }

  return null;
}
