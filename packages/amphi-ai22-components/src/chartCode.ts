import { ChartDefinition, ChartFieldRole } from './chartCatalog';

function encodeUtf8Base64(value: unknown): string {
  const bytes = new TextEncoder().encode(String(value ?? ''));
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function columnValue(value: unknown): string {
  if (Array.isArray(value)) {
    return String(value[0]?.value ?? '');
  }
  if (value && typeof value === 'object' && 'value' in value) {
    return String((value as { value?: unknown }).value ?? '');
  }
  return String(value ?? '');
}

function columnsValue(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map(columnValue).filter(Boolean);
}

function finiteInteger(value: unknown, fallback: number): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.trunc(numeric) : fallback;
}

function roleValue(config: any, role: ChartFieldRole): string | string[] {
  const value = config?.[`ai22Column_${role}`];
  return role === 'display' ? columnsValue(value) : columnValue(value);
}

export function buildChartComponentCode(
  definition: ChartDefinition,
  config: any,
  inputName: string,
  outputName: string
): string {
  const columns = Object.fromEntries(
    definition.fields.map(role => [role, roleValue(config, role)])
  );
  const width = Math.max(480, finiteInteger(config?.ai22Width, 960));
  const height = Math.max(320, finiteInteger(config?.ai22Height, 560));
  const topN = Math.max(1, finiteInteger(config?.ai22TopN, 50));
  const refreshSeconds = Math.max(
    1,
    finiteInteger(config?.ai22RefreshSeconds, 3)
  );
  const windowSize = Math.max(
    2,
    finiteInteger(config?.ai22WindowSize, 20)
  );
  return `
${outputName}, ${outputName}_metrics = render_amphi_ai22_chart(
    dataframe=${inputName},
    chart_type=${JSON.stringify(definition.renderer)},
    chart_id=${JSON.stringify(definition.id)},
    column_roles_base64=${JSON.stringify(encodeUtf8Base64(JSON.stringify(columns)))},
    title_base64=${JSON.stringify(encodeUtf8Base64(config?.ai22Title ?? definition.name))},
    output_path_base64=${JSON.stringify(encodeUtf8Base64(config?.ai22OutputPath ?? `charts/${definition.id}.html`))},
    aggregation=${JSON.stringify(config?.ai22Aggregation ?? 'sum')},
    width=${width},
    height=${height},
    top_n=${topN},
    refresh_seconds=${refreshSeconds},
    window_size=${windowSize}
)
`.trim();
}
