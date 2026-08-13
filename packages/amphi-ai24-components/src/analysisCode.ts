import { AnalysisDefinition } from './analysisCatalog';

function encodeUtf8Base64(value: string): string {
  const bytes = new TextEncoder().encode(value);
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

const COLUMN_FIELDS = [
  'ai24ValueColumn',
  'ai24TextColumn',
  'ai24DateColumn',
  'ai24ConditionColumn',
  'ai24OrderColumn',
  'ai24TimeColumn',
  'ai24XColumn',
  'ai24YColumn'
];

const MULTI_COLUMN_FIELDS = ['ai24GroupColumns', 'ai24FeatureColumns'];

function normalizedOptions(config: any): Record<string, unknown> {
  const options: Record<string, unknown> = { ...(config ?? {}) };
  for (const key of COLUMN_FIELDS) {
    options[key] = columnValue(config?.[key]);
  }
  for (const key of MULTI_COLUMN_FIELDS) {
    options[key] = columnsValue(config?.[key]);
  }
  return options;
}

export function buildAnalysisComponentCode(
  definition: AnalysisDefinition,
  config: any,
  inputName: string,
  outputName: string
): string {
  const options = encodeUtf8Base64(
    JSON.stringify(normalizedOptions(config))
  );
  return `
${outputName}, ${outputName}_model, ${outputName}_metrics = run_amphi_ai24_analysis(
    dataframe=${inputName},
    analysis_id=${JSON.stringify(definition.kind)},
    options_base64=${JSON.stringify(options)}
)
`.trim();
}
