function encodeUtf8Base64(value: unknown): string {
  const text = String(value ?? '');
  const bytes = new TextEncoder().encode(text);
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

function pythonString(value: unknown): string {
  return JSON.stringify(String(value ?? ''));
}

function pythonStringList(values: string[]): string {
  return `[${values.map(pythonString).join(', ')}]`;
}

export type EvaluationMethod =
  | 'ks'
  | 'pr'
  | 'roc'
  | 'classification'
  | 'regression';

export function buildEvaluationCode(
  method: EvaluationMethod,
  config: any,
  inputName: string,
  outputName: string
): string {
  return `
${outputName}, ${outputName}_metrics = evaluate_amphi_ai14_model(
    dataframe=${inputName},
    method=${pythonString(method)},
    target_column_base64=${pythonString(encodeUtf8Base64(columnValue(config?.ai14TargetColumn)))},
    prediction_column_base64=${pythonString(encodeUtf8Base64(columnValue(config?.ai14PredictionColumn)))},
    score_column_base64=${pythonString(encodeUtf8Base64(columnValue(config?.ai14ScoreColumn)))},
    positive_label_base64=${pythonString(encodeUtf8Base64(config?.ai14PositiveLabel))},
    model_name_base64=${pythonString(encodeUtf8Base64(config?.ai14ModelName))},
    model_path_base64=${pythonString(encodeUtf8Base64(config?.ai14ModelPath))}
)
`.trim();
}

export function buildBestModelCode(
  config: any,
  inputName: string,
  outputName: string
): string {
  return `
${outputName}, ${outputName}_metrics = select_amphi_ai14_best_model(
    dataframe=${inputName},
    metric_column_base64=${pythonString(encodeUtf8Base64(columnValue(config?.ai14MetricColumn)))},
    model_column_base64=${pythonString(encodeUtf8Base64(columnValue(config?.ai14ModelColumn)))},
    path_column_base64=${pythonString(encodeUtf8Base64(columnValue(config?.ai14PathColumn)))},
    direction=${pythonString(config?.ai14Direction ?? 'auto')}
)
`.trim();
}

export function buildModelExportCode(
  config: any,
  inputName: string,
  outputName: string
): string {
  const configuredVariable = String(config?.ai14ModelVariable ?? '').trim();
  const modelVariable = configuredVariable || `${inputName}_model`;
  return `
${outputName}, ${outputName}_metrics = export_amphi_ai14_model(
    dataframe=${inputName},
    model_variable_base64=${pythonString(encodeUtf8Base64(modelVariable))},
    output_path_base64=${pythonString(encodeUtf8Base64(config?.ai14ModelOutputPath))},
    serialization_format=${pythonString(config?.ai14SerializationFormat ?? 'joblib')}
)
`.trim();
}

export function buildModelReadCode(config: any, outputName: string): string {
  return `
${outputName}, ${outputName}_metrics = read_amphi_ai14_model(
    model_path_base64=${pythonString(encodeUtf8Base64(config?.ai14ModelInputPath))},
    registry_key_base64=${pythonString(encodeUtf8Base64(config?.ai14RegistryKey))}
)
`.trim();
}

export function buildModelUseCode(
  config: any,
  inputName1: string,
  inputName2: string,
  outputName: string
): string {
  const includeProbability = Boolean(config?.ai14IncludeProbability ?? true);
  return `
${outputName}, ${outputName}_metrics = use_amphi_ai14_model(
    first_dataframe=${inputName1},
    second_dataframe=${inputName2},
    feature_columns=${pythonStringList(columnsValue(config?.ai14FeatureColumns))},
    output_column_base64=${pythonString(encodeUtf8Base64(config?.ai14OutputColumn ?? 'model_prediction'))},
    include_probability=${includeProbability ? 'True' : 'False'}
)
`.trim();
}
