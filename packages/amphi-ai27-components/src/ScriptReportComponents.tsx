import {
  buildChartCode,
  buildReportExportCode,
  buildReportGeneratorCode,
  buildScriptExecutorCode,
  buildTemplateInputCode,
  DEFAULT_SCRIPT_CODE,
  ScriptLanguage
} from './scriptReportCode';
import { scriptReportRuntime } from './scriptReportRuntime';

const COMPONENT_CATEGORY = '平台扩展组件';

type ScriptDefinition = {
  language: ScriptLanguage;
  id: string;
  name: string;
  mode: string;
  extension: string;
  command: string;
  description: string;
  iconName: string;
  iconLabel: string;
  iconPath: string;
};

const scriptDefinitions: ScriptDefinition[] = [
  {
    language: 'r',
    id: 'rLanguageExecutor',
    name: 'R 语言执行',
    mode: 'r',
    extension: '^(.*\\.(R|r))$',
    command: 'Rscript',
    description:
      '调用 Rscript 执行源文件或内联 R 代码；使用 input 数据框并将结果赋给 output。',
    iconName: 'amphi-r-language-executor-icon',
    iconLabel: 'R',
    iconPath:
      'M5 4h8a5 5 0 0 1 0 10h-2l4 6h-4l-3.4-6H8v6H5V4Zm3 3v4h5a2 2 0 1 0 0-4H8Z'
  },
  {
    language: 'python',
    id: 'pythonLanguageExecutor',
    name: 'Python 语言执行',
    mode: 'python',
    extension: '^.*\\.py$',
    command: '',
    description:
      '在独立 Python 子进程中执行源文件或内联代码；使用 input DataFrame 并将结果赋给 output。',
    iconName: 'amphi-python-language-executor-icon',
    iconLabel: 'PY',
    iconPath:
      'M7 3h7a4 4 0 0 1 4 4v4h-7a3 3 0 0 0-3 3v2H6a4 4 0 0 1-4-4V8a5 5 0 0 1 5-5Zm3 3a1 1 0 1 0 0 .01V6Zm7 15h-7a4 4 0 0 1-4-4v-4h7a3 3 0 0 0 3-3V8h2a4 4 0 0 1 4 4v4a5 5 0 0 1-5 5Zm-3-3a1 1 0 1 0 0-.01V18Z'
  },
  {
    language: 'javascript',
    id: 'javascriptExecutor',
    name: 'JavaScript 脚本执行',
    mode: 'javascript',
    extension: '^.*\\.(js|mjs|cjs)$',
    command: 'node',
    description:
      '调用 Node.js 执行源文件或内联脚本；input 和 output 均为对象数组。',
    iconName: 'amphi-javascript-executor-icon',
    iconLabel: 'JS',
    iconPath:
      'M3 3h18v18H3V3Zm5 4v8.5c0 1-.5 1.5-1.4 1.5-.5 0-.9-.2-1.3-.6l-1.1 1.7c.8.7 1.7 1 2.7 1 2.3 0 3.7-1.2 3.7-3.7V7H8Zm8.3-.2c-2.5 0-4.1 1.4-4.1 3.4 0 2.1 1.3 2.9 3.3 3.8 1.4.6 1.8 1 1.8 1.7 0 .8-.6 1.3-1.7 1.3-1 0-1.9-.5-2.6-1.2l-1.4 1.7c1 1 2.4 1.6 4 1.6 2.7 0 4.4-1.4 4.4-3.6 0-2-1.1-2.9-3.2-3.8-1.5-.7-2-1-2-1.7 0-.7.6-1.1 1.5-1.1.8 0 1.5.3 2.2.9l1.3-1.7c-1-.9-2.2-1.3-3.8-1.3Z'
  }
];

function languageIcon(
  definition: ScriptDefinition
): { name: string; svgstr: string } {
  return {
    name: definition.iconName,
    svgstr: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="${definition.iconPath}"/><title>${definition.iconLabel}</title></svg>`
  };
}

class ScriptExecutorComponent extends (globalThis as any).Amphi
  .BaseCoreComponent {
  private readonly language: ScriptLanguage;

  constructor(definition: ScriptDefinition) {
    const defaultConfig = {
      scriptSourceMode: 'inline',
      scriptSourcePath: '',
      scriptInlineCode: DEFAULT_SCRIPT_CODE[definition.language],
      scriptArguments: '',
      scriptTimeoutSeconds: 30,
      scriptArtifactDirectory: '',
      scriptCommand: definition.command
    };
    const form = {
      idPrefix: `amphi_${definition.id}`,
      fields: [
        {
          type: 'info',
          id: 'scriptInfo',
          text: `${definition.description} 程序在服务器子进程中运行，只执行可信代码。`,
          advanced: false
        },
        {
          type: 'radio',
          label: '代码来源',
          id: 'scriptSourceMode',
          options: [
            { value: 'inline', label: '内联代码' },
            { value: 'file', label: '源文件' }
          ],
          advanced: false
        },
        {
          type: 'file',
          label: '源文件路径',
          id: 'scriptSourcePath',
          placeholder: '选择脚本文件',
          validation: definition.extension,
          condition: { scriptSourceMode: 'file' },
          advanced: false
        },
        {
          type: 'codeTextarea',
          label: '内联代码',
          id: 'scriptInlineCode',
          mode: definition.mode,
          height: '300px',
          condition: { scriptSourceMode: 'inline' },
          advanced: false
        },
        {
          type: 'input',
          label: '附加参数（可选）',
          id: 'scriptArguments',
          placeholder: '--name "学生"',
          advanced: true
        },
        {
          type: 'inputNumber',
          label: '运行超时（秒）',
          id: 'scriptTimeoutSeconds',
          min: 1,
          max: 600,
          step: 1,
          advanced: true
        },
        {
          type: 'input',
          label: '执行产物保存目录（可选）',
          id: 'scriptArtifactDirectory',
          placeholder: '留空时自动清理临时文件',
          advanced: true
        },
        {
          type: 'input',
          label: '运行命令',
          id: 'scriptCommand',
          placeholder:
            definition.language === 'python'
              ? '留空使用当前 Python'
              : definition.command,
          advanced: true
        }
      ]
    };
    super(
      definition.name,
      definition.id,
      definition.description,
      'pandas_df_processor',
      [],
      COMPONENT_CATEGORY,
      languageIcon(definition),
      defaultConfig,
      form
    );
    this.language = definition.language;
  }

  provideImports() {
    return [];
  }

  provideFunctions() {
    return [scriptReportRuntime];
  }

  generateComponentCode({ config, inputName, outputName }) {
    return buildScriptExecutorCode(
      this.language,
      config,
      inputName,
      outputName
    );
  }
}

class ChartReportComponent extends (globalThis as any).Amphi.BaseCoreComponent {
  constructor() {
    const defaultConfig = {
      chartType: 'bar',
      chartXColumn: [],
      chartYColumn: [],
      chartTitle: '数据图表',
      chartOutputPath: 'reports/amphi-chart.svg',
      chartWidth: 800,
      chartHeight: 480
    };
    const form = {
      idPrefix: 'amphi_chart_report',
      fields: [
        {
          type: 'info',
          id: 'chartInfo',
          text: '根据 DataFrame 生成可嵌入 HTML、Markdown 或 DOCX 报告的独立 SVG 图形。',
          advanced: false
        },
        {
          type: 'radio',
          label: '图表类型',
          id: 'chartType',
          options: [
            { value: 'bar', label: '柱状图' },
            { value: 'line', label: '折线图' },
            { value: 'scatter', label: '散点图' },
            { value: 'pie', label: '饼图' }
          ],
          advanced: false
        },
        {
          type: 'column',
          label: 'X/分类字段',
          id: 'chartXColumn',
          required: true,
          advanced: false
        },
        {
          type: 'column',
          label: 'Y/数值字段',
          id: 'chartYColumn',
          required: true,
          advanced: false
        },
        {
          type: 'input',
          label: '图表标题',
          id: 'chartTitle',
          advanced: false
        },
        {
          type: 'input',
          label: 'SVG 输出路径',
          id: 'chartOutputPath',
          required: true,
          advanced: false
        },
        {
          type: 'inputNumber',
          label: '宽度',
          id: 'chartWidth',
          min: 320,
          max: 2400,
          advanced: true
        },
        {
          type: 'inputNumber',
          label: '高度',
          id: 'chartHeight',
          min: 240,
          max: 1600,
          advanced: true
        }
      ]
    };
    const icon = {
      name: 'amphi-chart-report-icon',
      svgstr:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M3 3h2v16h16v2H3V3Zm4 10h3v4H7v-4Zm5-5h3v9h-3V8Zm5-3h3v12h-3V5Z"/></svg>'
    };
    super(
      '图形报表生成',
      'chartReportGenerator',
      '生成柱状图、折线图、散点图或饼图 SVG，并把图形路径传递给文档报告组件。',
      'pandas_df_processor',
      [],
      COMPONENT_CATEGORY,
      icon,
      defaultConfig,
      form
    );
  }

  provideImports() {
    return [];
  }

  provideFunctions() {
    return [scriptReportRuntime];
  }

  generateComponentCode({ config, inputName, outputName }) {
    return buildChartCode(config, inputName, outputName);
  }
}

class ReportTemplateInputComponent extends (globalThis as any).Amphi
  .BaseCoreComponent {
  constructor() {
    const defaultConfig = { reportTemplatePath: '' };
    const form = {
      idPrefix: 'amphi_report_template_input',
      fields: [
        {
          type: 'info',
          id: 'templateInfo',
          text: '读取 Markdown、HTML 或 DOCX 模板。可在右侧“文档报告”面板上传和编辑模板。',
          advanced: false
        },
        {
          type: 'file',
          label: '文档模板路径',
          id: 'reportTemplatePath',
          validation: '^.*\\.(md|markdown|html|htm|docx)$',
          required: true,
          advanced: false
        }
      ]
    };
    const icon = {
      name: 'amphi-report-template-input-icon',
      svgstr:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M5 2h10l4 4v16H5V2Zm9 2v3h3l-3-3ZM8 11h8V9H8v2Zm0 4h8v-2H8v2Zm0 4h6v-2H8v2Z"/></svg>'
    };
    super(
      '文档模板输入',
      'reportTemplateInput',
      '读取 Markdown、HTML 或 DOCX 文档模板并输出模板 DataFrame。',
      'pandas_df_input',
      ['md', 'markdown', 'html', 'htm', 'docx'],
      COMPONENT_CATEGORY,
      icon,
      defaultConfig,
      form
    );
  }

  provideImports() {
    return [];
  }

  provideFunctions() {
    return [scriptReportRuntime];
  }

  generateComponentCode({ config, outputName }) {
    return buildTemplateInputCode(config, outputName);
  }
}

class DocumentReportGeneratorComponent extends (globalThis as any).Amphi
  .BaseCoreComponent {
  constructor() {
    const defaultConfig = {
      reportSuggestedName: 'student-report',
      reportBindings: `{
  "metrics": {
    "平均值": "mean:score"
  },
  "tables": {
    "数据表": {
      "columns": [],
      "limit": 50
    }
  },
  "charts": {
    "default": "auto"
  }
}`
    };
    const form = {
      idPrefix: 'amphi_document_report_generator',
      fields: [
        {
          type: 'info',
          id: 'reportInfo',
          text: '连接一个业务 DataFrame 和一个“文档模板输入”。模板支持 metric、calc、table、chart 占位符。',
          advanced: false
        },
        {
          type: 'input',
          label: '报告文件名',
          id: 'reportSuggestedName',
          required: true,
          advanced: false
        },
        {
          type: 'codeTextarea',
          label: '指标、表格与图形绑定 JSON',
          id: 'reportBindings',
          mode: 'json',
          height: '280px',
          advanced: false
        }
      ]
    };
    const icon = {
      name: 'amphi-document-report-generator-icon',
      svgstr:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M4 2h11l5 5v15H4V2Zm10 2v4h4l-4-4ZM7 12h10v-2H7v2Zm0 4h4v-2H7v2Zm6 0h4v-2h-4v2Zm-6 3h10v-2H7v2Z"/></svg>'
    };
    super(
      '文档报告生成',
      'documentReportGenerator',
      '将数据指标、函数计算结果、表格和图形填充到文档模板中。',
      'pandas_df_double_processor',
      [],
      COMPONENT_CATEGORY,
      icon,
      defaultConfig,
      form
    );
  }

  provideImports() {
    return [];
  }

  provideFunctions() {
    return [scriptReportRuntime];
  }

  generateComponentCode({ config, inputName1, inputName2, outputName }) {
    return buildReportGeneratorCode(
      config,
      inputName1,
      inputName2,
      outputName
    );
  }
}

class DocumentReportExportComponent extends (globalThis as any).Amphi
  .BaseCoreComponent {
  constructor() {
    const defaultConfig = {
      reportOutputPath: 'reports/student-report.html'
    };
    const form = {
      idPrefix: 'amphi_document_report_export',
      fields: [
        {
          type: 'info',
          id: 'exportInfo',
          text: '将“文档报告生成”的结果写入 Jupyter 文件目录，再通过右侧文档报告面板下载。',
          advanced: false
        },
        {
          type: 'input',
          label: '报告输出路径',
          id: 'reportOutputPath',
          placeholder: 'reports/student-report.html',
          required: true,
          advanced: false
        }
      ]
    };
    const icon = {
      name: 'amphi-document-report-export-icon',
      svgstr:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M5 2h10l4 4v7h-2V8h-4V4H7v16h5v2H5V2Zm11 11h2v4h3l-4 4-4-4h3v-4Z"/></svg>'
    };
    super(
      '文档报告导出',
      'documentReportExport',
      '将生成的 Markdown、HTML 或 DOCX 报告保存为文件。',
      'pandas_df_output',
      [],
      COMPONENT_CATEGORY,
      icon,
      defaultConfig,
      form
    );
  }

  provideImports() {
    return [];
  }

  provideFunctions() {
    return [scriptReportRuntime];
  }

  generateComponentCode({ config, inputName }) {
    return buildReportExportCode(config, inputName);
  }
}

export const scriptReportComponents = new Map<string, unknown>([
  ...scriptDefinitions.map(definition => [
    definition.id,
    new ScriptExecutorComponent(definition)
  ] as [string, unknown]),
  ['chartReportGenerator', new ChartReportComponent()],
  ['reportTemplateInput', new ReportTemplateInputComponent()],
  ['documentReportGenerator', new DocumentReportGeneratorComponent()],
  ['documentReportExport', new DocumentReportExportComponent()]
]);
