import { existsSync, readFileSync, readdirSync, writeFileSync } from "fs";
import { join } from "path";
import { DEV_SCRIPT_CANDIDATES } from "../config/dev";
import { PROJECT_INDICATOR_FILES, SOURCE_FILE_EXTENSIONS } from "../config/init";

interface PackageJsonShape {
  scripts?: Record<string, string>;
}

// Determine whether cwd looks like a project root.
export function hasProjectFiles(cwd: string): boolean {
  for (const indicator of PROJECT_INDICATOR_FILES) {
    if (existsSync(join(cwd, indicator))) {
      return true;
    }
  }

  try {
    const files = readdirSync(cwd);
    for (const file of files) {
      if (SOURCE_FILE_EXTENSIONS.some((ext) => file.endsWith(ext))) {
        return true;
      }
    }
  } catch {
    // Ignore fs errors and return false.
  }

  return false;
}

// Wrap the first dev script in package.json with `siphon -- ...`.
export function wrapDevScript(cwd: string): boolean {
  const pkgPath = join(cwd, "package.json");
  if (!existsSync(pkgPath)) {
    return false;
  }

  try {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as PackageJsonShape;
    if (!pkg.scripts) {
      return false;
    }

    const devScriptName = DEV_SCRIPT_CANDIDATES.find((name) => pkg.scripts?.[name]);
    if (!devScriptName) {
      return false;
    }

    const currentScript = pkg.scripts[devScriptName];
    if (currentScript.startsWith("siphon ")) {
      return false;
    }

    pkg.scripts[devScriptName] = `siphon -- ${currentScript}`;
    writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");

    return true;
  } catch {
    return false;
  }
}
