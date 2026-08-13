export type AnalysisKind =
  | 'aggregate_total'
  | 'aggregate_count'
  | 'aggregate_population_std'
  | 'aggregate_population_variance'
  | 'aggregate_mean'
  | 'numeric_function'
  | 'text_function'
  | 'date_function'
  | 'conditional_function'
  | 'window_function'
  | 'year_over_year'
  | 'period_over_period'
  | 'cumulative_share'
  | 'alert_analysis'
  | 'conditional_formatting'
  | 'trendline_fitting'
  | 'reference_line'
  | 'time_series_forecast'
  | 'cluster_analysis';

export type AnalysisDefinition = {
  id: string;
  name: string;
  kind: AnalysisKind;
  description: string;
  iconLabel: string;
};

export const ANALYSIS_CATEGORY = '分析计算组件';

export const analysisCatalog: AnalysisDefinition[] = [
  {
    id: 'aggregateTotalCalculation',
    name: '合计计算',
    kind: 'aggregate_total',
    description: '按可选分组字段计算数值列合计。',
    iconLabel: '合计'
  },
  {
    id: 'aggregateCountCalculation',
    name: '计数计算',
    kind: 'aggregate_count',
    description: '按可选分组字段计算总行数或非空值数。',
    iconLabel: '计数'
  },
  {
    id: 'populationStdCalculation',
    name: '总体标准差',
    kind: 'aggregate_population_std',
    description: '按可选分组字段计算总体标准差（ddof=0）。',
    iconLabel: '总标'
  },
  {
    id: 'populationVarianceCalculation',
    name: '总体方差',
    kind: 'aggregate_population_variance',
    description: '按可选分组字段计算总体方差（ddof=0）。',
    iconLabel: '总方'
  },
  {
    id: 'aggregateMeanCalculation',
    name: '平均值计算',
    kind: 'aggregate_mean',
    description: '按可选分组字段计算数值列平均值。',
    iconLabel: '均值'
  },
  {
    id: 'numericFunctionCalculation',
    name: '数值函数计算',
    kind: 'numeric_function',
    description: '支持绝对值、四舍五入、平方根、对数、指数、幂和截断。',
    iconLabel: 'f(x)'
  },
  {
    id: 'textFunctionCalculation',
    name: '文本函数计算',
    kind: 'text_function',
    description: '支持去空格、大小写、长度、替换、包含和前后缀判断。',
    iconLabel: '文函'
  },
  {
    id: 'dateFunctionCalculation',
    name: '日期函数计算',
    kind: 'date_function',
    description: '提取年、季度、月、日、星期或计算与基准日的间隔。',
    iconLabel: '日函'
  },
  {
    id: 'conditionalFunctionCalculation',
    name: '条件函数计算',
    kind: 'conditional_function',
    description: '通过比较、区间或空值条件生成业务标签。',
    iconLabel: 'IF'
  },
  {
    id: 'windowFunctionCalculation',
    name: '窗口函数计算',
    kind: 'window_function',
    description: '支持排名、稠密排名、行号、滚动平均、滚动合计和累计合计。',
    iconLabel: '窗口'
  },
  {
    id: 'yearOverYearAnalysis',
    name: '同比分析',
    kind: 'year_over_year',
    description: '按月、季或年汇总指标，计算与上年同期的变化额和变化率。',
    iconLabel: '同比'
  },
  {
    id: 'periodOverPeriodAnalysis',
    name: '环比分析',
    kind: 'period_over_period',
    description: '按日、月、季或年汇总指标，计算与上一周期的变化额和变化率。',
    iconLabel: '环比'
  },
  {
    id: 'cumulativeShareAnalysis',
    name: '累计占比分析',
    kind: 'cumulative_share',
    description: '按排序与可选分组计算累计值、总额、单项占比和累计占比。',
    iconLabel: '累占'
  },
  {
    id: 'dataAlertAnalysis',
    name: '数据预警分析',
    kind: 'alert_analysis',
    description: '支持阈值、区间和空值规则，输出预警标记、级别和说明。',
    iconLabel: '预警'
  },
  {
    id: 'conditionalFormattingAnalysis',
    name: '多样条件格式',
    kind: 'conditional_formatting',
    description: '生成阈值高亮、色阶、数据条或图标集效果及自包含 HTML 报表。',
    iconLabel: '格式'
  },
  {
    id: 'trendlineFittingAnalysis',
    name: '趋势线拟合',
    kind: 'trendline_fitting',
    description: '支持线性、二次、三次和指数趋势线，输出拟合值、残差和评估指标。',
    iconLabel: '趋势'
  },
  {
    id: 'referenceLineAnalysis',
    name: '参考线分析',
    kind: 'reference_line',
    description: '使用固定值、平均值、中位数、分位数或极值生成参考线与偏差。',
    iconLabel: '参考'
  },
  {
    id: 'timeSeriesForecastAnalysis',
    name: '时序预测分析',
    kind: 'time_series_forecast',
    description: '通过线性趋势、移动平均或指数平滑预测未来时间点。',
    iconLabel: '时预'
  },
  {
    id: 'clusterExplorationAnalysis',
    name: '聚类分析',
    kind: 'cluster_analysis',
    description: '使用 KMeans 与可选标准化对多个数值特征分组，输出簇标签和中心距离。',
    iconLabel: '聚类'
  }
];
