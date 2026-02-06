// Quote shell arguments safely for a wrapped `sh -c` command.
export function quoteShellArg(arg: string): string {
  if (/["\s;|&$`\\]/.test(arg)) {
    return `'${arg.replace(/'/g, "'\\''")}'`;
  }

  return arg;
}
