export type ScriptLanguage = 'python' | 'r' | 'javascript';

export const DEFAULT_SCRIPT_CODE: Record<ScriptLanguage, string> = {
  python: `output = input.copy()
output["python_processed"] = True`,
  r: `output <- input
output$r_processed <- TRUE`,
  javascript: `output = input.map(row => ({
  ...row,
  js_processed: true
}));`
};

const LANGUAGE_COMMANDS: Record<ScriptLanguage, string> = {
  python: '',
  r: 'Rscript',
  javascript: 'node'
};

function encodeUtf8Base64(value: unknown): string {
  const bytes = new TextEncoder().encode(String(value ?? ''));
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function configuredValue(config: any, key: string, fallback = ''): string {
  const value = config?.[key];
  if (value && typeof value === 'object' && 'value' in value) {
    return String(value.value ?? fallback);
  }
  return String(value ?? fallback);
}

function boundedInteger(
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number
): number {
  const numeric = Number(value ?? fallback);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return Math.min(maximum, Math.max(minimum, Math.trunc(numeric)));
}

export function buildScriptExecutorCode(
  language: ScriptLanguage,
  config: any,
  inputName: string,
  outputName: string
): string {
  const sourceMode =
    configuredValue(config, 'scriptSourceMode', 'inline') === 'file'
      ? 'file'
      : 'inline';
  const timeoutSeconds = boundedInteger(
    config?.scriptTimeoutSeconds,
    30,
    1,
    600
  );
  const defaultCode = DEFAULT_SCRIPT_CODE[language];
  const command = configuredValue(
    config,
    'scriptCommand',
    LANGUAGE_COMMANDS[language]
  );

  return `
${outputName}, ${outputName}_metrics = run_amphi_script_program(
    dataframe=${inputName},
    language=${JSON.stringify(language)},
    source_mode=${JSON.stringify(sourceMode)},
    source_path_base64=${JSON.stringify(
      encodeUtf8Base64(configuredValue(config, 'scriptSourcePath'))
    )},
    inline_code_base64=${JSON.stringify(
      encodeUtf8Base64(
        configuredValue(config, 'scriptInlineCode', defaultCode)
      )
    )},
    arguments_base64=${JSON.stringify(
      encodeUtf8Base64(configuredValue(config, 'scriptArguments'))
    )},
    command_base64=${JSON.stringify(encodeUtf8Base64(command))},
    artifact_directory_base64=${JSON.stringify(
      encodeUtf8Base64(configuredValue(config, 'scriptArtifactDirectory'))
    )},
    timeout_seconds=${timeoutSeconds}
)
`.trim();
}

export function buildChartCode(
  config: any,
  inputName: string,
  outputName: string
): string {
  const chartType = configuredValue(config, 'chartType', 'bar');
  const safeType = ['bar', 'line', 'scatter', 'pie'].includes(chartType)
    ? chartType
    : 'bar';
  return `
${outputName}, ${outputName}_metrics = create_amphi_chart(
    dataframe=${inputName},
    chart_type=${JSON.stringify(safeType)},
    x_column_base64=${JSON.stringify(
      encodeUtf8Base64(configuredValue(config, 'chartXColumn'))
    )},
    y_column_base64=${JSON.stringify(
      encodeUtf8Base64(configuredValue(config, 'chartYColumn'))
    )},
    title_base64=${JSON.stringify(
      encodeUtf8Base64(configuredValue(config, 'chartTitle', '数据图表'))
    )},
    output_path_base64=${JSON.stringify(
      encodeUtf8Base64(
        configuredValue(config, 'chartOutputPath', 'reports/amphi-chart.svg')
      )
    )},
    width=${boundedInteger(config?.chartWidth, 800, 320, 2400)},
    height=${boundedInteger(config?.chartHeight, 480, 240, 1600)}
)
`.trim();
}

export function buildTemplateInputCode(
  config: any,
  outputName: string
): string {
  return `${outputName} = load_amphi_report_template(
    template_path_base64=${JSON.stringify(
      encodeUtf8Base64(configuredValue(config, 'reportTemplatePath'))
    )}
)`;
}

export function buildReportGeneratorCode(
  config: any,
  inputName1: string,
  inputName2: string,
  outputName: string
): string {
  const reportName =
    configuredValue(config, 'reportSuggestedName', 'student-report').trim() ||
    'student-report';
  return `
${outputName}, ${outputName}_metrics = generate_amphi_report(
    first_dataframe=${inputName1},
    second_dataframe=${inputName2},
    bindings_base64=${JSON.stringify(
      encodeUtf8Base64(configuredValue(config, 'reportBindings', '{}'))
    )},
    suggested_name_base64=${JSON.stringify(encodeUtf8Base64(reportName))}
)
`.trim();
}

export function buildReportExportCode(
  config: any,
  inputName: string
): string {
  return `export_amphi_report(
    report_dataframe=${inputName},
    output_path_base64=${JSON.stringify(
      encodeUtf8Base64(
        configuredValue(config, 'reportOutputPath', 'reports/student-report.html')
      )
    )}
)`;
}
