import { existsSync, readFileSync } from "fs";
import { join } from "path";

interface PackageJsonShape {
  scripts?: Record<string, string>;
}

export interface ProjectSetup {
  hasProject: boolean;
  hasDevScript: boolean;
  isWrapped: boolean;
}

// Determine if current cwd has a project and whether siphon has been initialized.
export function detectProjectSetup(cwd: string): ProjectSetup {
  const pkgPath = join(cwd, "package.json");
  if (!existsSync(pkgPath)) {
    return { hasProject: false, hasDevScript: false, isWrapped: false };
  }

  try {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as PackageJsonShape;
    const scripts = pkg.scripts ?? {};
    const devScript = scripts.dev || scripts.start || scripts.serve;

    if (!devScript) {
      return { hasProject: true, hasDevScript: false, isWrapped: false };
    }

    return {
      hasProject: true,
      hasDevScript: true,
      isWrapped: devScript.startsWith("siphon "),
    };
  } catch {
    return { hasProject: true, hasDevScript: false, isWrapped: false };
  }
}
