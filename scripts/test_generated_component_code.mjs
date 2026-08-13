#!/usr/bin/env node
/* Validate the Python option literals emitted for all component definitions. */

import { readFile } from 'node:fs/promises';

const { algorithmCatalog } = await import('../lib/algorithmCatalog.js');
const { algorithmIconIds, iconForAlgorithm } = await import(
  '../lib/algorithmIcons.js'
);
const { algorithmParameters } = await import('../lib/algorithmParameters.js');
const { pythonOptionsLiteral } = await import('../lib/pythonLiteral.js');
const {
  buildJavaExecutorCode,
  DEFAULT_JAVA_CODE
} = await import('../lib/javaExecutorCode.js');
const {
  buildChartCode,
  buildReportExportCode,
  buildReportGeneratorCode,
  buildScriptExecutorCode,
  buildTemplateInputCode,
  DEFAULT_SCRIPT_CODE
} = await import(
  '../packages/amphi-ai27-components/lib/scriptReportCode.js'
);
const {
  buildBestModelCode,
  buildEvaluationCode,
  buildModelExportCode,
  buildModelReadCode,
  buildModelUseCode
} = await import(
  '../packages/amphi-ai14-components/lib/modelEvaluationCode.js'
);
const { chartCatalog } = await import(
  '../packages/amphi-ai22-components/lib/chartCatalog.js'
);
const { iconForChart } = await import(
  '../packages/amphi-ai22-components/lib/chartIcons.js'
);
const { buildChartComponentCode } = await import(
  '../packages/amphi-ai22-components/lib/chartCode.js'
);
const { ANALYSIS_CATEGORY, analysisCatalog } = await import(
  '../packages/amphi-ai24-components/lib/analysisCatalog.js'
);
const { iconForAnalysis } = await import(
  '../packages/amphi-ai24-components/lib/analysisIcons.js'
);
const { buildAnalysisComponentCode } = await import(
  '../packages/amphi-ai24-components/lib/analysisCode.js'
);
const failures = [];
const iconIds = new Set(algorithmIconIds);
const iconNames = new Set();
const iconSources = new Set();
const classicKinds = new Set([
  'classification',
  'clustering',
  'regression',
  'association',
  'timeseries',
  'evaluation',
  'recommendation'
]);
const expectedCategories = new Map([
  ['机器学习组件', 51],
  ['集成学习组件', 4],
  ['深度学习组件', 5],
  ['文本分析组件', 10],
  ['自动学习组件', 5]
]);
const classicComponents = algorithmCatalog.filter(definition =>
  classicKinds.has(definition.kind)
);

if (classicComponents.length !== 51) {
  failures.push(
    `Expected 51 classic algorithm components, found ${classicComponents.length}`
  );
}
for (const definition of classicComponents) {
  if (definition.category !== '机器学习组件') {
    failures.push(
      `${definition.id}: classic algorithm is outside the unified sidebar group`
    );
  }
}
for (const [category, expectedCount] of expectedCategories) {
  const actualCount = algorithmCatalog.filter(
    definition => definition.category === category
  ).length;
  if (actualCount !== expectedCount) {
    failures.push(
      `${category}: expected ${expectedCount} components, found ${actualCount}`
    );
  }
}
if (
  new Set(algorithmCatalog.map(definition => definition.category)).size !==
  expectedCategories.size
) {
  failures.push('Catalog contains an unexpected sidebar category');
}

for (const definition of algorithmCatalog) {
  const id = definition.id;
  const options = Object.fromEntries(
    (algorithmParameters[id] ?? []).map(parameter => [
      parameter.key,
      parameter.defaultValue
    ])
  );
  const literal = pythonOptionsLiteral(options);
  if (/:\s*(true|false)\b/.test(literal)) {
    failures.push(`${id}: emitted a JavaScript boolean in Python code`);
  }
  if (
    Object.values(options).some(value => value === true) &&
    !literal.includes('True')
  ) {
    failures.push(`${id}: Python True literal is missing`);
  }
  if (
    Object.values(options).some(value => value === false) &&
    !literal.includes('False')
  ) {
    failures.push(`${id}: Python False literal is missing`);
  }
  if (!iconIds.has(id)) {
    failures.push(`${id}: algorithm-specific icon is missing`);
    continue;
  }
  const icon = iconForAlgorithm(id, definition.kind);
  if (iconNames.has(icon.name)) {
    failures.push(`${id}: icon name is not unique`);
  }
  if (iconSources.has(icon.svgstr)) {
    failures.push(`${id}: SVG icon is not unique`);
  }
  if (!icon.svgstr.includes('currentColor')) {
    failures.push(`${id}: SVG icon does not follow the currentColor theme`);
  }
  iconNames.add(icon.name);
  iconSources.add(icon.svgstr);
}

for (const id of iconIds) {
  if (!algorithmCatalog.some(definition => definition.id === id)) {
    failures.push(`${id}: icon has no matching catalog component`);
  }
}

const generatedJavaCode = buildJavaExecutorCode(
  {
    javaSourceMode: 'inline',
    javaInlineCode: DEFAULT_JAVA_CODE,
    javaSourcePath: '/Untitled Folder/{unsafe}.java',
    javaMainClass: '',
    javaArguments: '--name "测试 用户"',
    javaClasspath: '',
    javaArtifactDirectory: '',
    javacCommand: 'javac',
    javaCommand: 'java',
    javaTimeoutSeconds: 30,
    javaResultMode: 'auto'
  },
  'input_dataframe',
  'java_result'
);
if (!generatedJavaCode.startsWith('java_result, java_result_metrics =')) {
  failures.push('javaExecutor: generated output variables are incorrect');
}
if (generatedJavaCode.includes('public static void main')) {
  failures.push('javaExecutor: raw Java source leaked into generated Python');
}
if (generatedJavaCode.includes('{unsafe}')) {
  failures.push('javaExecutor: source path was not safely encoded');
}
if (/:\s*(true|false|null)\b/.test(generatedJavaCode)) {
  failures.push('javaExecutor: generated Python contains JavaScript literals');
}
const inlineMatch = generatedJavaCode.match(
  /inline_code_base64="([A-Za-z0-9+/=]+)"/
);
if (
  !inlineMatch ||
  Buffer.from(inlineMatch[1], 'base64').toString('utf8') !== DEFAULT_JAVA_CODE
) {
  failures.push('javaExecutor: inline Java UTF-8 base64 encoding is incorrect');
}
const javaComponentSource = await readFile(
  new URL('../src/JavaExecutorComponent.tsx', import.meta.url),
  'utf8'
);
if (!javaComponentSource.includes("'javaExecutor'")) {
  failures.push('javaExecutor: super() id does not match registration id');
}
if (!javaComponentSource.includes("'pandas_df_processor'")) {
  failures.push('javaExecutor: component type must be pandas_df_processor');
}
if (!javaComponentSource.includes("'编程语言组件'")) {
  failures.push('javaExecutor: component category is incorrect');
}
if (
  !javaComponentSource.includes("name: 'amphi-java-executor-icon'") ||
  !javaComponentSource.includes('>JAVA</text>')
) {
  failures.push('javaExecutor: dedicated Java icon is missing');
}

for (const language of ['python', 'r', 'javascript']) {
  const scriptCode = buildScriptExecutorCode(
    language,
    {
      scriptSourceMode: 'inline',
      scriptInlineCode: DEFAULT_SCRIPT_CODE[language],
      scriptSourcePath: '/scripts/{unsafe}',
      scriptArguments: '--name "测试学生"',
      scriptTimeoutSeconds: 30
    },
    'input_dataframe',
    `${language}_result`
  );
  if (scriptCode.includes(DEFAULT_SCRIPT_CODE[language])) {
    failures.push(`${language}Executor: raw source leaked into generated Python`);
  }
  if (scriptCode.includes('{unsafe}')) {
    failures.push(`${language}Executor: source path was not safely encoded`);
  }
}

const reportGeneratedCalls = [
  buildChartCode(
    {
      chartType: 'bar',
      chartXColumn: { value: 'name' },
      chartYColumn: { value: 'score' },
      chartTitle: '学生{成绩}',
      chartOutputPath: 'reports/chart.svg'
    },
    'input_dataframe',
    'chart_result'
  ),
  buildTemplateInputCode(
    { reportTemplatePath: '/templates/{report}.html' },
    'template_result'
  ),
  buildReportGeneratorCode(
    {
      reportSuggestedName: 'student-report',
      reportBindings: '{"metrics":{"平均分":"mean:score"}}'
    },
    'data_input',
    'template_input',
    'report_result'
  ),
  buildReportExportCode(
    { reportOutputPath: '/reports/{student}.html' },
    'report_input'
  )
];
if (reportGeneratedCalls.some(code => code.includes('{student}'))) {
  failures.push('report components: output path was not safely encoded');
}
if (
  reportGeneratedCalls.some(code =>
    /:\s*(true|false|null)\b/.test(code)
  )
) {
  failures.push('script/report components: generated Python has JS literals');
}

const scriptReportComponentSource = await readFile(
  new URL(
    '../packages/amphi-ai27-components/src/ScriptReportComponents.tsx',
    import.meta.url
  ),
  'utf8'
);
const ai27Manifest = JSON.parse(
  await readFile(
    new URL(
      '../packages/amphi-ai27-components/package.json',
      import.meta.url
    ),
    'utf8'
  )
);
const ai27IndexSource = await readFile(
  new URL('../packages/amphi-ai27-components/src/index.ts', import.meta.url),
  'utf8'
);
if (ai27Manifest.name !== '@local-ai/amphi-ai27-components') {
  failures.push('AI27 package: npm scope or package basename is incorrect');
}
if (!ai27IndexSource.includes("'@local-ai/amphi-ai27-components:plugin'")) {
  failures.push('AI27 package: plugin id does not match package name');
}
const unifiedCategoryMatches = scriptReportComponentSource.match(
  /COMPONENT_CATEGORY/g
) ?? [];
if (
  !scriptReportComponentSource.includes(
    "const COMPONENT_CATEGORY = '平台扩展组件'"
  ) ||
  unifiedCategoryMatches.length !== 6
) {
  failures.push('script/report components: expected one unified sidebar group');
}
for (const oldCategory of [
  "'编程语言组件'",
  "'图形展示组件'",
  "'文档报告组件'"
]) {
  if (scriptReportComponentSource.includes(oldCategory)) {
    failures.push(
      `script/report components: legacy category remains ${oldCategory}`
    );
  }
}
for (const id of [
  'rLanguageExecutor',
  'pythonLanguageExecutor',
  'javascriptExecutor',
  'chartReportGenerator',
  'reportTemplateInput',
  'documentReportGenerator',
  'documentReportExport'
]) {
  if (!scriptReportComponentSource.includes(`'${id}'`)) {
    failures.push(`${id}: component id or registration entry is missing`);
  }
}

const ai14GeneratedCalls = [
  ...['ks', 'pr', 'roc', 'classification', 'regression'].map(method =>
    buildEvaluationCode(
      method,
      {
        ai14TargetColumn: { value: 'target' },
        ai14PredictionColumn: { value: 'prediction' },
        ai14ScoreColumn: { value: 'probability' },
        ai14PositiveLabel: '是',
        ai14ModelName: `model-${method}`,
        ai14ModelPath: '/models/{unsafe}.joblib'
      },
      'evaluation_input',
      `${method}_evaluation`
    )
  ),
  buildBestModelCode(
    {
      ai14MetricColumn: { value: 'metric_value' },
      ai14ModelColumn: { value: 'model_name' },
      ai14PathColumn: { value: 'model_path' },
      ai14Direction: 'auto'
    },
    'evaluation_table',
    'best_model'
  ),
  buildModelExportCode(
    {
      ai14ModelVariable: '',
      ai14ModelOutputPath: '/models/{unsafe}.joblib',
      ai14SerializationFormat: 'joblib'
    },
    'trained_dataframe',
    'model_descriptor'
  ),
  buildModelReadCode(
    {
      ai14ModelInputPath: '/models/{unsafe}.joblib',
      ai14RegistryKey: 'loaded-model'
    },
    'loaded_descriptor'
  ),
  buildModelUseCode(
    {
      ai14FeatureColumns: [{ value: 'feature_a' }],
      ai14IncludeProbability: true
    },
    'scoring_dataframe',
    'loaded_descriptor',
    'scored_dataframe'
  )
];
if (ai14GeneratedCalls.some(code => code.includes('{unsafe}'))) {
  failures.push('AI14 components: unsafe path was not base64 encoded');
}
if (
  ai14GeneratedCalls.some(code => /:\s*(true|false|null)\b/.test(code))
) {
  failures.push('AI14 components: generated Python contains JS literals');
}
const exportedVariableMatch = ai14GeneratedCalls[6].match(
  /model_variable_base64="([A-Za-z0-9+/=]+)"/
);
if (
  !exportedVariableMatch ||
  Buffer.from(exportedVariableMatch[1], 'base64').toString('utf8') !==
    'trained_dataframe_model'
) {
  failures.push('AI14 model export: upstream model variable is not automatic');
}

const ai14Manifest = JSON.parse(
  await readFile(
    new URL('../packages/amphi-ai14-components/package.json', import.meta.url),
    'utf8'
  )
);
const ai14IndexSource = await readFile(
  new URL('../packages/amphi-ai14-components/src/index.ts', import.meta.url),
  'utf8'
);
const ai14ComponentSource = await readFile(
  new URL(
    '../packages/amphi-ai14-components/src/ModelEvaluationComponents.tsx',
    import.meta.url
  ),
  'utf8'
);
if (ai14Manifest.name !== '@local-ai/amphi-ai14-components') {
  failures.push('AI14 package: npm scope or package basename is incorrect');
}
if (!ai14IndexSource.includes("'@local-ai/amphi-ai14-components:plugin'")) {
  failures.push('AI14 package: plugin id does not match package name');
}
for (const id of [
  'ksModelEvaluation',
  'prModelEvaluation',
  'rocModelEvaluation',
  'classificationModelEvaluation',
  'regressionModelEvaluation',
  'bestModelSelection',
  'modelArtifactExport',
  'modelArtifactInput',
  'modelPredictionUse'
]) {
  if (!ai14IndexSource.includes(`'${id}'`)) {
    failures.push(`AI14 package: registration id is missing ${id}`);
  }
  if (!ai14ComponentSource.includes(`'${id}'`)) {
    failures.push(`AI14 package: component id is missing ${id}`);
  }
}
if (
  !ai14ComponentSource.includes(
    "const COMPONENT_CATEGORY = '模型评估与管理组件'"
  )
) {
  failures.push('AI14 components: unified sidebar category is missing');
}

if (chartCatalog.length !== 50) {
  failures.push(`AI22 package: expected 50 charts, found ${chartCatalog.length}`);
}
const chartCategories = new Set(
  chartCatalog.map(definition => definition.category)
);
if (chartCategories.size !== 1 || !chartCategories.has('图表组件')) {
  failures.push('AI22 package: all 50 charts must use the 图表组件 group');
}
const chartIds = new Set();
const chartIconNames = new Set();
const chartIconSources = new Set();
for (const [index, definition] of chartCatalog.entries()) {
  if (chartIds.has(definition.id)) {
    failures.push(`AI22 package: duplicate chart id ${definition.id}`);
  }
  chartIds.add(definition.id);
  const icon = iconForChart(definition, index);
  if (chartIconNames.has(icon.name)) {
    failures.push(`AI22 package: duplicate icon name ${icon.name}`);
  }
  if (chartIconSources.has(icon.svgstr)) {
    failures.push(`AI22 package: duplicate icon source ${definition.id}`);
  }
  if (!icon.svgstr.includes(definition.iconLabel)) {
    failures.push(`AI22 package: icon does not reflect name ${definition.id}`);
  }
  chartIconNames.add(icon.name);
  chartIconSources.add(icon.svgstr);

  const config = {
    ai22Title: `${definition.name}{unsafe}`,
    ai22OutputPath: `/charts/${definition.id}{unsafe}.html`,
    ai22Aggregation: 'sum',
    ai22Width: 960,
    ai22Height: 560,
    ai22TopN: 50,
    ai22RefreshSeconds: 3,
    ai22WindowSize: 20
  };
  for (const role of definition.fields) {
    config[`ai22Column_${role}`] =
      role === 'display'
        ? [{ value: 'field{unsafe}' }]
        : { value: `${role}{unsafe}` };
  }
  const generated = buildChartComponentCode(
    definition,
    config,
    'chart_input',
    `${definition.id}_output`
  );
  if (generated.includes('{unsafe}')) {
    failures.push(`AI22 package: unsafe value leaked for ${definition.id}`);
  }
  if (/=\s*(true|false|null)\b/.test(generated)) {
    failures.push(`AI22 package: generated Python has JS literals ${definition.id}`);
  }
}

const ai22Manifest = JSON.parse(
  await readFile(
    new URL('../packages/amphi-ai22-components/package.json', import.meta.url),
    'utf8'
  )
);
const ai22IndexSource = await readFile(
  new URL('../packages/amphi-ai22-components/src/index.ts', import.meta.url),
  'utf8'
);
if (ai22Manifest.name !== '@local-ai/amphi-ai22-components') {
  failures.push('AI22 package: npm scope or package basename is incorrect');
}
if (!ai22IndexSource.includes("'@local-ai/amphi-ai22-components:plugin'")) {
  failures.push('AI22 package: plugin id does not match package name');
}

if (analysisCatalog.length !== 19) {
  failures.push(
    `AI24 package: expected 19 analysis components, found ${analysisCatalog.length}`
  );
}
if (ANALYSIS_CATEGORY !== '分析计算组件') {
  failures.push('AI24 package: unified sidebar category is incorrect');
}
const analysisIds = new Set();
const analysisKinds = new Set();
const analysisIconNames = new Set();
const analysisIconSources = new Set();
for (const [index, definition] of analysisCatalog.entries()) {
  if (analysisIds.has(definition.id)) {
    failures.push(`AI24 package: duplicate component id ${definition.id}`);
  }
  if (analysisKinds.has(definition.kind)) {
    failures.push(`AI24 package: duplicate runtime kind ${definition.kind}`);
  }
  analysisIds.add(definition.id);
  analysisKinds.add(definition.kind);
  const icon = iconForAnalysis(definition, index);
  if (analysisIconNames.has(icon.name)) {
    failures.push(`AI24 package: duplicate icon name ${icon.name}`);
  }
  if (analysisIconSources.has(icon.svgstr)) {
    failures.push(`AI24 package: duplicate icon source ${definition.id}`);
  }
  if (!icon.svgstr.includes(definition.iconLabel)) {
    failures.push(`AI24 package: icon does not reflect name ${definition.id}`);
  }
  analysisIconNames.add(icon.name);
  analysisIconSources.add(icon.svgstr);

  const generated = buildAnalysisComponentCode(
    definition,
    {
      ai24ValueColumn: { value: 'value{unsafe}' },
      ai24TextColumn: { value: 'text{unsafe}' },
      ai24DateColumn: { value: 'date{unsafe}' },
      ai24GroupColumns: [{ value: 'group{unsafe}' }],
      ai24FeatureColumns: [{ value: 'feature{unsafe}' }],
      ai24TrueLabel: 'true{unsafe}',
      ai24Standardize: 'true'
    },
    'analysis_input',
    `${definition.id}_output`
  );
  if (generated.includes('{unsafe}')) {
    failures.push(`AI24 package: unsafe value leaked for ${definition.id}`);
  }
  if (/=\s*(true|false|null)\b/.test(generated)) {
    failures.push(`AI24 package: generated Python has JS literals ${definition.id}`);
  }
  if (!generated.includes(`${definition.id}_output_model`)) {
    failures.push(`AI24 package: model output is missing ${definition.id}`);
  }
  if (!generated.includes(`${definition.id}_output_metrics`)) {
    failures.push(`AI24 package: metrics output is missing ${definition.id}`);
  }
}

const ai24Manifest = JSON.parse(
  await readFile(
    new URL('../packages/amphi-ai24-components/package.json', import.meta.url),
    'utf8'
  )
);
const ai24IndexSource = await readFile(
  new URL('../packages/amphi-ai24-components/src/index.ts', import.meta.url),
  'utf8'
);
if (ai24Manifest.name !== '@local-ai/amphi-ai24-components') {
  failures.push('AI24 package: npm scope or package basename is incorrect');
}
if (!ai24IndexSource.includes("'@local-ai/amphi-ai24-components:plugin'")) {
  failures.push('AI24 package: plugin id does not match package name');
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log(
  `Generated component test passed: ${algorithmCatalog.length} algorithms, Java, 7 script/report, 9 AI14, 50 AI22, and 19 AI24 components.`
);
