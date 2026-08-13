export type ChartCategory = '图表组件';

const CHART_CATEGORY: ChartCategory = '图表组件';

export type ChartFieldRole =
  | 'x'
  | 'y'
  | 'value'
  | 'series'
  | 'label'
  | 'latitude'
  | 'longitude'
  | 'source'
  | 'target'
  | 'start'
  | 'end'
  | 'size'
  | 'display';

export type ChartDefinition = {
  id: string;
  name: string;
  category: ChartCategory;
  renderer: string;
  description: string;
  fields: ChartFieldRole[];
  iconLabel: string;
};

const common: ChartDefinition[] = [
  ['columnLineCombo', '柱线组合图', 'combo', '柱形与折线共同展示两个指标。', ['x', 'y', 'value'], '柱线'],
  ['verticalCombo', '纵向组合图', 'vertical_combo', '纵向排列多指标组合图。', ['x', 'y', 'value'], '纵组'],
  ['roseChart', '玫瑰图', 'rose', '以极坐标扇区半径表现分类数值。', ['label', 'value'], '玫瑰'],
  ['gaugeChart', '仪表盘', 'gauge', '以仪表盘展示汇总指标及目标比例。', ['value'], '仪表'],
  ['textKpi', '文字 KPI', 'text_kpi', '以大号文字、增减状态展示核心指标。', ['value'], 'KPI'],
  ['liquidKpi', '水球图（KPI）', 'liquid', '以水位填充效果展示完成比例。', ['value'], '水球'],
  ['administrativeMap', '行政地图', 'admin_map', '按行政区域名称和数值生成分级区域图。', ['label', 'value'], '行政'],
  ['markerMap', '标记地图', 'marker_map', '按经纬度、标签和数值绘制地理标记。', ['longitude', 'latitude', 'label', 'value'], '标记'],
  ['migrationMap', '迁徙地图', 'migration_map', '按来源、去向和流量展示迁徙关系。', ['source', 'target', 'value'], '迁徙'],
  ['dataList', '列表', 'list', '把选择的数据字段生成分页友好的列表。', ['display'], '列表'],
  ['crossTable', '交叉表', 'crosstab', '按行列维度交叉汇总指标。', ['x', 'series', 'value'], '交叉'],
  ['freeReport', '自由式报表', 'free_report', '自动组合 KPI、明细表和摘要信息。', ['display'], '报表'],
  ['barChart', '柱状图', 'bar', '按分类比较数值大小。', ['x', 'y'], '柱状'],
  ['lineChart', '折线图', 'line', '按顺序展示数值变化趋势。', ['x', 'y'], '折线'],
  ['pieChart', '饼图', 'pie', '展示分类占比。', ['label', 'value'], '饼图'],
  ['scatterChart', '散点图', 'scatter', '展示两个数值指标的分布关系。', ['x', 'y'], '散点'],
  ['areaChart', '面积图', 'area', '以填充面积表现趋势与规模。', ['x', 'y'], '面积'],
  ['bubbleChart', '气泡图', 'bubble', '以位置和气泡大小展示三个指标。', ['x', 'y', 'size'], '气泡'],
  ['radarChart', '雷达图', 'radar', '在多个指标轴上比较数值。', ['label', 'value'], '雷达'],
  ['donutChart', '环形图', 'donut', '使用中空圆环展示分类占比。', ['label', 'value'], '环图']
].map(([id, name, renderer, description, fields, iconLabel]) => ({
  id: id as string,
  name: name as string,
  category: CHART_CATEGORY,
  renderer: renderer as string,
  description: description as string,
  fields: fields as ChartFieldRole[],
  iconLabel: iconLabel as string
}));

const advanced: ChartDefinition[] = [
  ['sunburstChart', '旭日图', 'sunburst', '以多层环形结构表现层级占比。', ['source', 'target', 'value'], '旭日'],
  ['jadeRingChart', '玉玦图', 'jade_ring', '以不闭合环形条比较多个分类值。', ['label', 'value'], '玉玦'],
  ['treeMapChart', '矩形树图', 'treemap', '以嵌套矩形面积表现分类规模。', ['label', 'value'], '矩树'],
  ['funnelChart', '漏斗图', 'funnel', '展示流程阶段的逐级转化。', ['label', 'value'], '漏斗'],
  ['relationshipChart', '关系图', 'relationship', '按来源、目标与权重展示关系网络。', ['source', 'target', 'value'], '关系'],
  ['wordCloudChart', '词云图', 'wordcloud', '按词语权重调整文字大小。', ['label', 'value'], '词云'],
  ['waterfallChart', '瀑布图', 'waterfall', '展示各项增减对累计值的影响。', ['x', 'y'], '瀑布'],
  ['boxPlotChart', '箱线图', 'boxplot', '展示分类数据的四分位数和异常分布。', ['x', 'value'], '箱线'],
  ['sankeyChart', '桑基图', 'sankey', '以连线宽度展示节点间流量。', ['source', 'target', 'value'], '桑基'],
  ['forceDirectedChart', '力向导图', 'force', '以力导向式节点布局展示关系。', ['source', 'target', 'value'], '力导'],
  ['heatMapChart', '热力图', 'heatmap', '使用颜色深浅展示二维矩阵数值。', ['x', 'y', 'value'], '热力'],
  ['ganttChart', '甘特图', 'gantt', '按任务开始、结束时间展示项目排期。', ['label', 'start', 'end'], '甘特'],
  ['parallelChart', '平行坐标图', 'parallel', '通过多条平行轴比较多维数据。', ['x', 'y', 'value'], '平行'],
  ['violinChart', '小提琴图', 'violin', '展示分类数值的分布密度与中位数。', ['x', 'value'], '提琴'],
  ['densityChart', '密度图', 'density', '估计连续数值的分布密度。', ['value'], '密度'],
  ['calendarHeatMap', '日历热力图', 'calendar_heatmap', '按日期网格显示每天的数值强度。', ['x', 'value'], '日历'],
  ['chordChart', '弦图', 'chord', '以圆周节点和弦线展示双向关系。', ['source', 'target', 'value'], '弦图'],
  ['polarChart', '极坐标图', 'polar', '在极坐标系中比较分类指标。', ['label', 'value'], '极坐'],
  ['edgeBundlingChart', '层级边捆绑图', 'edge_bundling', '将层级关系边聚合成紧凑网络。', ['source', 'target', 'value'], '边束'],
  ['geoHeatMap', '地理热力图', 'geo_heatmap', '按经纬度与权重生成地理热区。', ['longitude', 'latitude', 'value'], '地热']
].map(([id, name, renderer, description, fields, iconLabel]) => ({
  id: id as string,
  name: name as string,
  category: CHART_CATEGORY,
  renderer: renderer as string,
  description: description as string,
  fields: fields as ChartFieldRole[],
  iconLabel: iconLabel as string
}));

const timeSeries: ChartDefinition[] = [
  ['timeLineChart', '时序线图', 'time_line', '按时间排序展示连续趋势。', ['x', 'y'], '时线'],
  ['timeBarChart', '时序柱图', 'time_bar', '按时间周期比较数值。', ['x', 'y'], '时柱'],
  ['timeAreaChart', '时序面积图', 'time_area', '以面积展示随时间变化的规模。', ['x', 'y'], '时面'],
  ['timeGaugeChart', '时序仪表盘', 'time_gauge', '动态轮播时间点的仪表值。', ['x', 'y'], '时表'],
  ['timeLiquidChart', '时序水球图', 'time_liquid', '动态轮播时间点的水位 KPI。', ['x', 'y'], '时水'],
  ['timeScatterChart', '时序散点图', 'time_scatter', '按时间轴展示离散观测点。', ['x', 'y'], '时散'],
  ['timeHeatMapChart', '时序热力图', 'time_heatmap', '按时间与分类维度展示数值强度。', ['x', 'series', 'value'], '时热']
].map(([id, name, renderer, description, fields, iconLabel]) => ({
  id: id as string,
  name: name as string,
  category: CHART_CATEGORY,
  renderer: renderer as string,
  description: description as string,
  fields: fields as ChartFieldRole[],
  iconLabel: iconLabel as string
}));

const realtime: ChartDefinition[] = [
  ['realtimeLineChart', '实时线图', 'realtime_line', '按刷新间隔滚动播放最新窗口数据。', ['x', 'y'], '实线'],
  ['realtimeLabelChart', '实时标签图', 'realtime_label', '按刷新间隔更新当前标签和值。', ['label', 'value'], '实签'],
  ['realtimeGaugeChart', '实时仪表盘', 'realtime_gauge', '按刷新间隔更新仪表盘数值。', ['x', 'y'], '实表']
].map(([id, name, renderer, description, fields, iconLabel]) => ({
  id: id as string,
  name: name as string,
  category: CHART_CATEGORY,
  renderer: renderer as string,
  description: description as string,
  fields: fields as ChartFieldRole[],
  iconLabel: iconLabel as string
}));

export const chartCatalog: ChartDefinition[] = [
  ...common,
  ...advanced,
  ...timeSeries,
  ...realtime
];
