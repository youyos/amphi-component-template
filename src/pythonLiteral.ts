/** Serialize numeric and boolean options as a Python dictionary literal. */
export function pythonOptionsLiteral(
  options: Record<string, number | boolean>
): string {
  const entries = Object.entries(options).map(([key, value]) => {
    const literal =
      typeof value === 'boolean'
        ? value
          ? 'True'
          : 'False'
        : String(value);
    return `${JSON.stringify(key)}: ${literal}`;
  });
  return `{${entries.join(', ')}}`;
}
