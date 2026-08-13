import {
  chartCatalog,
  ChartDefinition,
  ChartFieldRole
} from './chartCatalog';
import { buildChartComponentCode } from './chartCode';
import { iconForChart } from './chartIcons';
import { chartRuntime } from './chartRuntime';

const ROLE_LABELS: Record<ChartFieldRole, string> = {
  x: 'X / 分类 / 时间字段',
  y: 'Y 数值字段',
  value: '指标数值字段',
  series: '系列 / 列维度字段',
  label: '标签 / 区域字段',
  latitude: '纬度字段',
  longitude: '经度字段',
  source: '来源 / 父级字段',
  target: '目标 / 子级字段',
  start: '开始时间字段',
  end: '结束时间字段',
  size: '气泡大小字段',
  display: '报表显示字段'
};

const AGGREGATED_RENDERERS = new Set([
  'combo',
  'vertical_combo',
  'rose',
  'admin_map',
  'crosstab',
  'bar',
  'line',
  'pie',
  'area',
  'radar',
  'donut',
  'sunburst',
  'jade_ring',
  'treemap',
  'funnel',
  'wordcloud',
  'parallel',
  'polar',
  'time_line',
  'time_bar',
  'time_area',
  'realtime_line'
]);

const WINDOW_RENDERERS = new Set([
  'time_gauge',
  'time_liquid',
  'realtime_line',
  'realtime_label',
  'realtime_gauge'
]);

const KPI_RENDERERS = new Set([
  'gauge',
  'text_kpi',
  'liquid',
  'time_gauge',
  'time_liquid',
  'realtime_label',
  'realtime_gauge'
]);

function roleField(role: ChartFieldRole) {
  return {
    type: role === 'display' ? 'columns' : 'column',
    label: ROLE_LABELS[role],
    id: `ai22Column_${role}`,
    placeholder:
      role === 'display' ? '留空显示全部字段' : `选择${ROLE_LABELS[role]}`,
    required: role !== 'display',
    advanced: false
  };
}

class ZeroCodeChartComponent extends (globalThis as any).Amphi
  .BaseCoreComponent {
  private readonly definition: ChartDefinition;

  constructor(definition: ChartDefinition, index: number) {
    const defaultConfig: Record<string, unknown> = {
      ai22Title: definition.name,
      ai22OutputPath: `charts/${definition.id}.html`,
      ai22Aggregation: 'sum',
      ai22Width: 960,
      ai22Height: 560,
      ai22TopN: 50,
      ai22RefreshSeconds: 3,
      ai22WindowSize: 20
    };
    for (const role of definition.fields) {
      defaultConfig[`ai22Column_${role}`] = [];
    }
    const fields: any[] = [
      {
        type: 'info',
        id: 'ai22ChartInfo',
        text: `${definition.description} 输出自包含 HTML 图表，并自动增加 ai22_chart_path 字段。`,
        advanced: false
      },
      ...definition.fields.map(roleField),
      {
        type: 'input',
        label: '图表标题',
        id: 'ai22Title',
        required: true,
        advanced: false
      }
    ];
    if (AGGREGATED_RENDERERS.has(definition.renderer)) {
      fields.push({
        type: 'radio',
        label: '聚合方式',
        id: 'ai22Aggregation',
        options: [
          { value: 'sum', label: '求和' },
          { value: 'mean', label: '平均值' },
          { value: 'count', label: '计数' },
          { value: 'max', label: '最大值' },
          { value: 'min', label: '最小值' }
        ],
        advanced: false
      });
    }
    if (!KPI_RENDERERS.has(definition.renderer)) {
      fields.push({
        type: 'inputNumber',
        label: '最大展示条数',
        id: 'ai22TopN',
        min: 1,
        max: 5000,
        step: 1,
        advanced: true
      });
    }
    if (WINDOW_RENDERERS.has(definition.renderer)) {
      fields.push(
        {
          type: 'inputNumber',
          label: '刷新/轮播间隔（秒）',
          id: 'ai22RefreshSeconds',
          min: 1,
          max: 3600,
          step: 1,
          advanced: false
        },
        {
          type: 'inputNumber',
          label: '实时数据窗口',
          id: 'ai22WindowSize',
          min: 2,
          max: 500,
          step: 1,
          advanced: false
        }
      );
    }
    fields.push(
      {
        type: 'input',
        label: 'HTML 输出路径',
        id: 'ai22OutputPath',
        required: true,
        advanced: true
      },
      {
        type: 'inputNumber',
        label: '图表宽度',
        id: 'ai22Width',
        min: 480,
        max: 2400,
        step: 10,
        advanced: true
      },
      {
        type: 'inputNumber',
        label: '图表高度',
        id: 'ai22Height',
        min: 320,
        max: 1600,
        step: 10,
        advanced: true
      }
    );
    const form = {
      idPrefix: `amphi_ai22_${definition.id}`,
      fields
    };
    super(
      definition.name,
      definition.id,
      definition.description,
      'pandas_df_processor',
      [],
      definition.category,
      iconForChart(definition, index),
      defaultConfig,
      form
    );
    this.definition = definition;
  }

  provideImports() {
    return [];
  }

  provideFunctions() {
    return [chartRuntime];
  }

  generateComponentCode({ config, inputName, outputName }) {
    return buildChartComponentCode(
      this.definition,
      config,
      inputName,
      outputName
    );
  }
}

export const chartComponents = new Map<string, unknown>(
  chartCatalog.map((definition, index) => [
    definition.id,
    new ZeroCodeChartComponent(definition, index)
  ])
);
