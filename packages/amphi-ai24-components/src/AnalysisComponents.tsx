import {
  ANALYSIS_CATEGORY,
  analysisCatalog,
  AnalysisDefinition,
  AnalysisKind
} from './analysisCatalog';
import { buildAnalysisComponentCode } from './analysisCode';
import { iconForAnalysis } from './analysisIcons';
import { analysisRuntime } from './analysisRuntime';

type FormField = Record<string, unknown>;

const aggregateKinds = new Set<AnalysisKind>([
  'aggregate_total',
  'aggregate_count',
  'aggregate_population_std',
  'aggregate_population_variance',
  'aggregate_mean'
]);

const defaultConfig: Record<string, unknown> = {
  ai24ValueColumn: [],
  ai24TextColumn: [],
  ai24DateColumn: [],
  ai24ConditionColumn: [],
  ai24OrderColumn: [],
  ai24TimeColumn: [],
  ai24XColumn: [],
  ai24YColumn: [],
  ai24GroupColumns: [],
  ai24FeatureColumns: [],
  ai24MissingPolicy: 'ignore',
  ai24NumericOperation: 'abs',
  ai24Decimals: 2,
  ai24Operand: 2,
  ai24LowerBound: 0,
  ai24UpperBound: 100,
  ai24TextOperation: 'trim',
  ai24TextArgument: '',
  ai24TextReplacement: '',
  ai24DateOperation: 'year',
  ai24BaselineDate: '2026-01-01',
  ai24ConditionOperator: 'gt',
  ai24ConditionValue: 0,
  ai24ConditionUpperValue: 100,
  ai24TrueLabel: '是',
  ai24FalseLabel: '否',
  ai24WindowOperation: 'rank',
  ai24WindowSize: 3,
  ai24Ascending: 'false',
  ai24Frequency: 'M',
  ai24Aggregation: 'sum',
  ai24AlertRule: 'gt',
  ai24AlertThreshold: 80,
  ai24AlertUpperThreshold: 100,
  ai24WarningLevel: '高',
  ai24WarningMessage: '指标超出预警范围',
  ai24FormatType: 'threshold',
  ai24TrueColor: '#ffccc7',
  ai24FalseColor: '#d9f7be',
  ai24FormatOutputPath: 'reports/ai24-conditional-format.html',
  ai24TrendMethod: 'linear',
  ai24ReferenceType: 'mean',
  ai24ReferenceValue: 0,
  ai24Quantile: 0.75,
  ai24ForecastMethod: 'linear_trend',
  ai24ForecastHorizon: 6,
  ai24ForecastFrequency: 'auto',
  ai24SmoothingAlpha: 0.3,
  ai24ClusterCount: 3,
  ai24Standardize: 'true',
  ai24RandomSeed: 42
};

function columnField(
  id: string,
  label: string,
  required = true,
  advanced = false
): FormField {
  return { type: 'column', id, label, required, advanced };
}

function columnsField(id: string, label: string): FormField {
  return {
    type: 'columns',
    id,
    label,
    placeholder: '可选；留空表示全表计算',
    required: false,
    advanced: false
  };
}

function numberField(
  id: string,
  label: string,
  min?: number,
  max?: number,
  step = 1,
  advanced = false
): FormField {
  return { type: 'inputNumber', id, label, min, max, step, advanced };
}

function inputField(
  id: string,
  label: string,
  advanced = false
): FormField {
  return { type: 'input', id, label, advanced };
}

function radioField(
  id: string,
  label: string,
  options: Array<{ value: string; label: string }>,
  advanced = false
): FormField {
  return { type: 'radio', id, label, options, advanced };
}

function valueAndGroupFields(valueRequired = true): FormField[] {
  return [
    columnField('ai24ValueColumn', '指标数值字段', valueRequired),
    columnsField('ai24GroupColumns', '分组字段（可选）')
  ];
}

function aggregationFields(kind: AnalysisKind): FormField[] {
  const valueRequired = kind !== 'aggregate_count';
  return [
    ...valueAndGroupFields(valueRequired),
    radioField('ai24MissingPolicy', '缺失值处理', [
      { value: 'ignore', label: '忽略缺失值' },
      { value: 'fill_zero', label: '按 0 计算' },
      { value: 'error', label: '发现缺失值即报错' }
    ])
  ];
}

function comparisonOptions(): Array<{ value: string; label: string }> {
  return [
    { value: 'gt', label: '大于' },
    { value: 'ge', label: '大于等于' },
    { value: 'lt', label: '小于' },
    { value: 'le', label: '小于等于' },
    { value: 'eq', label: '等于' },
    { value: 'ne', label: '不等于' },
    { value: 'between', label: '介于两值之间' },
    { value: 'outside', label: '位于两值之外' },
    { value: 'is_null', label: '为空' },
    { value: 'not_null', label: '不为空' }
  ];
}

function periodFields(includeDay: boolean): FormField[] {
  const frequencies = [
    ...(includeDay ? [{ value: 'D', label: '按日' }] : []),
    { value: 'M', label: '按月' },
    { value: 'Q', label: '按季度' },
    { value: 'Y', label: '按年' }
  ];
  return [
    columnField('ai24TimeColumn', '时间字段'),
    columnField('ai24ValueColumn', '指标数值字段'),
    columnsField('ai24GroupColumns', '分组字段（可选）'),
    radioField('ai24Frequency', '分析周期', frequencies),
    radioField('ai24Aggregation', '周期汇总方式', [
      { value: 'sum', label: '合计' },
      { value: 'mean', label: '平均值' },
      { value: 'count', label: '计数' },
      { value: 'max', label: '最大值' },
      { value: 'min', label: '最小值' }
    ])
  ];
}

function fieldsForAnalysis(kind: AnalysisKind): FormField[] {
  if (aggregateKinds.has(kind)) {
    return aggregationFields(kind);
  }

  switch (kind) {
    case 'numeric_function':
      return [
        columnField('ai24ValueColumn', '数值字段'),
        radioField('ai24NumericOperation', '数值函数', [
          { value: 'abs', label: '绝对值 ABS' },
          { value: 'round', label: '四舍五入 ROUND' },
          { value: 'sqrt', label: '平方根 SQRT' },
          { value: 'log', label: '自然对数 LOG' },
          { value: 'exp', label: '指数 EXP' },
          { value: 'power', label: '幂 POWER' },
          { value: 'clip', label: '上下限截断 CLIP' }
        ]),
        numberField('ai24Decimals', '小数位数', 0, 12, 1, true),
        numberField('ai24Operand', '幂指数', -10, 10, 0.1, true),
        numberField('ai24LowerBound', '截断下限', undefined, undefined, 0.1, true),
        numberField('ai24UpperBound', '截断上限', undefined, undefined, 0.1, true)
      ];
    case 'text_function':
      return [
        columnField('ai24TextColumn', '文本字段'),
        radioField('ai24TextOperation', '文本函数', [
          { value: 'trim', label: '去除首尾空格' },
          { value: 'upper', label: '转大写' },
          { value: 'lower', label: '转小写' },
          { value: 'length', label: '文本长度' },
          { value: 'replace', label: '替换文本' },
          { value: 'contains', label: '是否包含' },
          { value: 'starts_with', label: '是否以指定文本开头' },
          { value: 'ends_with', label: '是否以指定文本结尾' }
        ]),
        inputField('ai24TextArgument', '查找/判断文本'),
        inputField('ai24TextReplacement', '替换为', true)
      ];
    case 'date_function':
      return [
        columnField('ai24DateColumn', '日期时间字段'),
        radioField('ai24DateOperation', '日期函数', [
          { value: 'year', label: '年' },
          { value: 'quarter', label: '季度' },
          { value: 'month', label: '月' },
          { value: 'day', label: '日' },
          { value: 'weekday', label: '星期' },
          { value: 'week', label: '周次' },
          { value: 'days_since', label: '与基准日相差天数' }
        ]),
        inputField('ai24BaselineDate', '基准日期（YYYY-MM-DD）', true)
      ];
    case 'conditional_function':
      return [
        columnField('ai24ConditionColumn', '条件字段'),
        radioField('ai24ConditionOperator', '判断条件', comparisonOptions()),
        inputField('ai24ConditionValue', '比较值/区间下限'),
        inputField('ai24ConditionUpperValue', '区间上限', true),
        inputField('ai24TrueLabel', '条件成立输出'),
        inputField('ai24FalseLabel', '条件不成立输出')
      ];
    case 'window_function':
      return [
        columnField('ai24ValueColumn', '计算数值字段'),
        columnsField('ai24GroupColumns', '分组字段（可选）'),
        columnField('ai24OrderColumn', '排序字段（可选）', false),
        radioField('ai24WindowOperation', '窗口函数', [
          { value: 'rank', label: '排名' },
          { value: 'dense_rank', label: '稠密排名' },
          { value: 'row_number', label: '行号' },
          { value: 'rolling_mean', label: '滚动平均' },
          { value: 'rolling_sum', label: '滚动合计' },
          { value: 'cumulative_sum', label: '累计合计' }
        ]),
        numberField('ai24WindowSize', '滚动窗口大小', 1, 10000),
        radioField('ai24Ascending', '排序方向', [
          { value: 'true', label: '升序' },
          { value: 'false', label: '降序' }
        ])
      ];
    case 'year_over_year':
      return periodFields(false);
    case 'period_over_period':
      return periodFields(true);
    case 'cumulative_share':
      return [
        ...valueAndGroupFields(),
        columnField('ai24OrderColumn', '排序字段（可选）', false),
        radioField('ai24Ascending', '排序方向', [
          { value: 'false', label: '指标降序' },
          { value: 'true', label: '指标升序' }
        ])
      ];
    case 'alert_analysis':
      return [
        columnField('ai24ValueColumn', '预警指标字段'),
        radioField('ai24AlertRule', '预警规则', comparisonOptions()),
        inputField('ai24AlertThreshold', '阈值/区间下限'),
        inputField('ai24AlertUpperThreshold', '区间上限', true),
        inputField('ai24WarningLevel', '预警级别'),
        inputField('ai24WarningMessage', '预警说明')
      ];
    case 'conditional_formatting':
      return [
        columnField('ai24ValueColumn', '条件格式指标字段'),
        radioField('ai24FormatType', '格式类型', [
          { value: 'threshold', label: '阈值高亮' },
          { value: 'color_scale', label: '连续色阶' },
          { value: 'data_bar', label: '数据条' },
          { value: 'icon_set', label: '图标集' }
        ]),
        numberField('ai24AlertThreshold', '高亮阈值', undefined, undefined, 0.1),
        inputField('ai24TrueColor', '命中颜色（CSS 颜色）', true),
        inputField('ai24FalseColor', '未命中颜色（CSS 颜色）', true),
        inputField('ai24FormatOutputPath', 'HTML 报表输出路径', true)
      ];
    case 'trendline_fitting':
      return [
        columnField('ai24XColumn', 'X 数值字段'),
        columnField('ai24YColumn', 'Y 数值字段'),
        radioField('ai24TrendMethod', '趋势线方法', [
          { value: 'linear', label: '线性' },
          { value: 'polynomial_2', label: '二次多项式' },
          { value: 'polynomial_3', label: '三次多项式' },
          { value: 'exponential', label: '指数' }
        ])
      ];
    case 'reference_line':
      return [
        ...valueAndGroupFields(),
        radioField('ai24ReferenceType', '参考线类型', [
          { value: 'fixed', label: '固定值' },
          { value: 'mean', label: '平均值' },
          { value: 'median', label: '中位数' },
          { value: 'quantile', label: '分位数' },
          { value: 'min', label: '最小值' },
          { value: 'max', label: '最大值' }
        ]),
        numberField('ai24ReferenceValue', '固定参考值', undefined, undefined, 0.1, true),
        numberField('ai24Quantile', '分位数', 0, 1, 0.01, true)
      ];
    case 'time_series_forecast':
      return [
        columnField('ai24TimeColumn', '时间字段'),
        columnField('ai24ValueColumn', '预测指标字段'),
        radioField('ai24ForecastMethod', '预测方法', [
          { value: 'linear_trend', label: '线性趋势外推' },
          { value: 'moving_average', label: '移动平均' },
          { value: 'exponential_smoothing', label: '指数平滑' }
        ]),
        numberField('ai24ForecastHorizon', '预测期数', 1, 1000),
        radioField('ai24ForecastFrequency', '未来时间频率', [
          { value: 'auto', label: '自动推断' },
          { value: 'D', label: '日' },
          { value: 'W', label: '周' },
          { value: 'M', label: '月' },
          { value: 'Q', label: '季度' },
          { value: 'Y', label: '年' }
        ]),
        numberField('ai24WindowSize', '移动平均窗口', 1, 1000, 1, true),
        numberField('ai24SmoothingAlpha', '指数平滑系数', 0.01, 1, 0.01, true)
      ];
    case 'cluster_analysis':
      return [
        {
          ...columnsField('ai24FeatureColumns', '聚类特征字段'),
          placeholder: '选择至少一个数值特征',
          required: true
        },
        numberField('ai24ClusterCount', '聚类数 K', 2, 100),
        radioField('ai24Standardize', '特征标准化', [
          { value: 'true', label: '启用' },
          { value: 'false', label: '不启用' }
        ]),
        numberField('ai24RandomSeed', '随机种子', 0, 2147483647, 1, true)
      ];
  }
}

class AnalysisComponent extends (globalThis as any).Amphi.BaseCoreComponent {
  private readonly definition: AnalysisDefinition;

  constructor(definition: AnalysisDefinition, index: number) {
    const fields = [
      {
        type: 'info',
        id: `ai24Info_${definition.id}`,
        text: `${definition.description} 结果列会自动命名，并输出指标与可用模型对象。`,
        advanced: false
      },
      ...fieldsForAnalysis(definition.kind)
    ];
    super(
      definition.name,
      definition.id,
      definition.description,
      'pandas_df_processor',
      [],
      ANALYSIS_CATEGORY,
      iconForAnalysis(definition, index),
      { ...defaultConfig },
      { idPrefix: `amphi_ai24_${definition.id}`, fields }
    );
    this.definition = definition;
  }

  provideImports() {
    return [];
  }

  provideFunctions() {
    return [analysisRuntime];
  }

  generateComponentCode({ config, inputName, outputName }) {
    return buildAnalysisComponentCode(
      this.definition,
      config,
      inputName,
      outputName
    );
  }
}

export const analysisComponents = new Map<string, unknown>(
  analysisCatalog.map((definition, index) => [
    definition.id,
    new AnalysisComponent(definition, index)
  ])
);
