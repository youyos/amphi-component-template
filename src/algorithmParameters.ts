export type AlgorithmParameter = {
  key: string;
  label: string;
  type: 'inputNumber' | 'boolean';
  defaultValue: number | boolean;
  min?: number;
  max?: number;
  step?: number;
  advanced?: boolean;
};

const numberParameter = (
  key: string,
  label: string,
  defaultValue: number,
  min = 0,
  step = 1,
  max?: number
): AlgorithmParameter => ({
  key,
  label,
  type: 'inputNumber',
  defaultValue,
  min,
  max,
  step,
  advanced: false
});

const booleanParameter = (
  key: string,
  label: string,
  defaultValue: boolean
): AlgorithmParameter => ({
  key,
  label,
  type: 'boolean',
  defaultValue,
  advanced: false
});

export const algorithmParameters: Record<string, AlgorithmParameter[]> = {
  c45PlusClassifier: [
    numberParameter('testSize', '测试集比例', 0.2, 0.05, 0.05, 0.5),
    booleanParameter('pruning', '启用剪枝', true),
    numberParameter('minSamplesLeaf', '叶节点最少样本数', 2, 1)
  ],
  xgboostClassifier: [
    numberParameter('nEstimators', '提升轮数', 100, 10, 10),
    numberParameter('learningRate', '学习率', 0.1, 0.01, 0.01, 1),
    numberParameter('maxDepth', '最大深度', 6, 1)
  ],
  knnClassifier: [
    numberParameter('nNeighbors', '邻居数量 K', 5, 1),
    booleanParameter('distanceWeight', '使用距离加权', true)
  ],
  naiveBayesClassifier: [
    numberParameter('varSmoothing', '方差平滑系数', 0.000000001, 0, 0.000000001)
  ],
  bpNeuralClassifier: [
    numberParameter('hiddenUnits', '隐藏层神经元数', 32, 2),
    numberParameter('maxIterations', '最大迭代次数', 500, 50, 50),
    numberParameter('learningRate', '初始学习率', 0.001, 0.0001, 0.0001)
  ],
  lhalfSparseClassifier: [
    numberParameter('regularization', '稀疏正则强度', 1, 0.01, 0.01),
    numberParameter('maxIterations', '最大迭代次数', 1000, 100, 100)
  ],
  logisticClassifier: [
    numberParameter('regularization', '正则化强度 C', 1, 0.01, 0.01),
    numberParameter('maxIterations', '最大迭代次数', 500, 100, 100)
  ],
  svmClassifier: [
    numberParameter('regularization', '惩罚系数 C', 1, 0.01, 0.01),
    numberParameter('gamma', 'RBF 核 Gamma', 0.1, 0.0001, 0.01)
  ],
  randomForestClassifier: [
    numberParameter('nEstimators', '决策树数量', 100, 10, 10),
    numberParameter('maxDepth', '最大深度（0 为不限）', 0, 0),
    numberParameter('minSamplesLeaf', '叶节点最少样本数', 1, 1)
  ],
  gradientBoostingClassifier: [
    numberParameter('nEstimators', '提升树数量', 100, 10, 10),
    numberParameter('learningRate', '学习率', 0.1, 0.01, 0.01),
    numberParameter('maxDepth', '单棵树最大深度', 3, 1)
  ],
  kmeansClustering: [
    numberParameter('nClusters', '聚类数量 K', 3, 2),
    numberParameter('nInit', '初始化次数', 10, 1)
  ],
  emClustering: [
    numberParameter('nClusters', '高斯分量数量', 3, 2),
    numberParameter('maxIterations', '最大迭代次数', 100, 10, 10)
  ],
  twoStepClustering: [
    numberParameter('nClusters', '最终聚类数量', 3, 2),
    numberParameter('preClusters', '预聚类数量', 9, 2)
  ],
  fuzzyCMeansClustering: [
    numberParameter('nClusters', '聚类数量', 3, 2),
    numberParameter('fuzziness', '模糊系数', 2, 1.1, 0.1)
  ],
  visualClustering: [
    numberParameter('eps', '投影邻域半径', 0.8, 0.01, 0.05),
    numberParameter('minSamples', '核心点最少样本数', 3, 2)
  ],
  dbscanClustering: [
    numberParameter('eps', '邻域半径 Eps', 0.5, 0.01, 0.05),
    numberParameter('minSamples', '核心点最少样本数', 5, 2)
  ],
  agglomerativeClustering: [
    numberParameter('nClusters', '聚类数量', 3, 2)
  ],
  spectralClustering: [
    numberParameter('nClusters', '聚类数量', 3, 2),
    numberParameter('nNeighbors', '相似图邻居数', 10, 1)
  ],
  linearRegression: [booleanParameter('fitIntercept', '拟合截距', true)],
  svmRegression: [
    numberParameter('regularization', '惩罚系数 C', 1, 0.01, 0.01),
    numberParameter('epsilon', '不敏感区间 Epsilon', 0.1, 0, 0.01),
    numberParameter('gamma', 'RBF 核 Gamma', 0.1, 0.0001, 0.01)
  ],
  gradientBoostingRegression: [
    numberParameter('nEstimators', '提升树数量', 100, 10, 10),
    numberParameter('learningRate', '学习率', 0.1, 0.01, 0.01),
    numberParameter('maxDepth', '单棵树最大深度', 3, 1)
  ],
  bpNeuralRegression: [
    numberParameter('hiddenUnits', '隐藏层神经元数', 32, 2),
    numberParameter('maxIterations', '最大迭代次数', 600, 50, 50),
    numberParameter('learningRate', '初始学习率', 0.001, 0.0001, 0.0001)
  ],
  isotonicRegression: [
    booleanParameter('increasing', '保持单调递增', true)
  ],
  lhalfSparseRegression: [
    numberParameter('alpha', '稀疏正则强度', 0.01, 0.0001, 0.001),
    numberParameter('maxIterations', '最大迭代次数', 5000, 100, 100)
  ],
  ridgeRegression: [numberParameter('alpha', 'L2 正则强度', 1, 0.0001, 0.01)],
  lassoRegression: [
    numberParameter('alpha', 'L1 正则强度', 0.01, 0.0001, 0.001),
    numberParameter('maxIterations', '最大迭代次数', 5000, 100, 100)
  ],
  randomForestRegression: [
    numberParameter('nEstimators', '决策树数量', 100, 10, 10),
    numberParameter('maxDepth', '最大深度（0 为不限）', 0, 0),
    numberParameter('minSamplesLeaf', '叶节点最少样本数', 1, 1)
  ],
  elasticNetRegression: [
    numberParameter('alpha', '总正则强度', 0.01, 0.0001, 0.001),
    numberParameter('l1Ratio', 'L1 占比', 0.5, 0, 0.05, 1)
  ],
  aprioriAssociation: [
    numberParameter('minSupport', '最小支持度', 0.1, 0.01, 0.01, 1),
    numberParameter('minConfidence', '最小置信度', 0.5, 0.01, 0.05, 1)
  ],
  fpGrowthAssociation: [
    numberParameter('minSupport', '最小支持度', 0.1, 0.01, 0.01, 1),
    numberParameter('minConfidence', '最小置信度', 0.5, 0.01, 0.05, 1)
  ],
  eclatAssociation: [
    numberParameter('minSupport', '最小支持度', 0.1, 0.01, 0.01, 1),
    numberParameter('minConfidence', '最小置信度', 0.5, 0.01, 0.05, 1)
  ],
  weightedAssociation: [
    numberParameter('minSupport', '最小加权支持度', 0.1, 0.01, 0.01, 1),
    numberParameter('minConfidence', '最小置信度', 0.5, 0.01, 0.05, 1)
  ],
  sequentialPatternAssociation: [
    numberParameter('minSupport', '最小序列支持度', 0.1, 0.01, 0.01, 1),
    numberParameter('maxPatternLength', '最大模式长度', 3, 2)
  ],
  arimaForecast: [
    numberParameter('p', '自回归阶数 p', 2, 0),
    numberParameter('d', '差分阶数 d', 1, 0),
    numberParameter('horizon', '预测步数', 3, 1)
  ],
  sparseTimeSeriesForecast: [
    numberParameter('lags', '候选滞后阶数', 6, 1),
    numberParameter('alpha', '稀疏正则强度', 0.001, 0.0001, 0.001),
    numberParameter('horizon', '预测步数', 3, 1)
  ],
  exponentialSmoothingForecast: [
    numberParameter('alpha', '水平平滑系数', 0.3, 0.01, 0.05, 1),
    numberParameter('horizon', '预测步数', 3, 1)
  ],
  greyForecast: [numberParameter('horizon', '预测步数', 3, 1)],
  echoStateNetworkForecast: [
    numberParameter('reservoirSize', '储备池规模', 50, 4),
    numberParameter('spectralRadius', '谱半径', 0.9, 0.1, 0.1),
    numberParameter('horizon', '预测步数', 3, 1)
  ],
  movingAverageForecast: [
    numberParameter('window', '移动窗口', 3, 2),
    numberParameter('horizon', '预测步数', 3, 1)
  ],
  holtWintersForecast: [
    numberParameter('seasonLength', '季节周期', 4, 2),
    numberParameter('horizon', '预测步数', 3, 1)
  ],
  linearTrendForecast: [numberParameter('horizon', '预测步数', 3, 1)],
  entropyWeightEvaluation: [booleanParameter('normalize', '自动正向归一化', true)],
  ahpEvaluation: [
    numberParameter('consistencyThreshold', '一致性阈值', 0.1, 0.01, 0.01)
  ],
  fuzzyComprehensiveEvaluation: [
    numberParameter('membershipPower', '隶属度指数', 0.5, 0.1, 0.1)
  ],
  topsisEvaluation: [booleanParameter('normalize', '向量归一化', true)],
  pcaEvaluation: [numberParameter('components', '主成分数量', 1, 1)],
  userCollaborativeFiltering: [
    numberParameter('neighbors', '相似用户数量', 10, 1),
    numberParameter('minInteractions', '最少共同交互数', 2, 1)
  ],
  itemCollaborativeFiltering: [
    numberParameter('neighbors', '相似物品数量', 10, 1),
    numberParameter('minInteractions', '最少共同交互数', 2, 1)
  ],
  matrixFactorizationRecommendation: [
    numberParameter('factors', '潜在因子数量', 8, 1),
    numberParameter('regularization', '正则化强度', 0.02, 0, 0.01)
  ],
  popularityRecommendation: [
    numberParameter('minimumCount', '最少交互次数', 1, 1)
  ],
  contentBasedRecommendation: [
    numberParameter('neighbors', '相似物品数量', 10, 1)
  ],
  baggingClassifier: [
    numberParameter('testSize', '测试集比例', 0.2, 0.05, 0.05, 0.5),
    numberParameter('nEstimators', '基学习器数量', 50, 5, 5),
    numberParameter('maxSamples', '单个学习器样本比例', 0.8, 0.1, 0.05, 1),
    numberParameter('maxFeatures', '单个学习器特征比例', 1, 0.1, 0.05, 1)
  ],
  baggingRegressor: [
    numberParameter('testSize', '测试集比例', 0.2, 0.05, 0.05, 0.5),
    numberParameter('nEstimators', '基学习器数量', 50, 5, 5),
    numberParameter('maxSamples', '单个学习器样本比例', 0.8, 0.1, 0.05, 1),
    numberParameter('maxFeatures', '单个学习器特征比例', 1, 0.1, 0.05, 1)
  ],
  votingClassifier: [
    numberParameter('testSize', '测试集比例', 0.2, 0.05, 0.05, 0.5),
    numberParameter('logisticWeight', '逻辑回归权重', 1, 0, 0.1),
    numberParameter('forestWeight', '随机森林权重', 1, 0, 0.1),
    numberParameter('svmWeight', '支持向量机权重', 1, 0, 0.1)
  ],
  votingRegressor: [
    numberParameter('testSize', '测试集比例', 0.2, 0.05, 0.05, 0.5),
    numberParameter('linearWeight', '线性回归权重', 1, 0, 0.1),
    numberParameter('forestWeight', '随机森林权重', 1, 0, 0.1),
    numberParameter('boostingWeight', '梯度提升权重', 1, 0, 0.1)
  ],
  dnnClassifier: [
    numberParameter('testSize', '测试集比例', 0.2, 0.05, 0.05, 0.5),
    numberParameter('hiddenUnits1', '第一隐藏层神经元数', 64, 4),
    numberParameter('hiddenUnits2', '第二隐藏层神经元数', 32, 2),
    numberParameter('maxIterations', '最大迭代次数', 600, 50, 50),
    numberParameter('learningRate', '初始学习率', 0.001, 0.0001, 0.0001)
  ],
  dnnRegressor: [
    numberParameter('testSize', '测试集比例', 0.2, 0.05, 0.05, 0.5),
    numberParameter('hiddenUnits1', '第一隐藏层神经元数', 64, 4),
    numberParameter('hiddenUnits2', '第二隐藏层神经元数', 32, 2),
    numberParameter('maxIterations', '最大迭代次数', 700, 50, 50),
    numberParameter('learningRate', '初始学习率', 0.001, 0.0001, 0.0001)
  ],
  rnnClassifier: [
    numberParameter('testSize', '测试集比例', 0.2, 0.05, 0.05, 0.5),
    numberParameter('hiddenUnits', '递归隐藏单元数', 32, 4),
    numberParameter('spectralRadius', '递归谱半径', 0.85, 0.1, 0.05, 0.99),
    numberParameter('regularization', '输出层正则强度', 1, 0.01, 0.01)
  ],
  rnnRegressor: [
    numberParameter('testSize', '测试集比例', 0.2, 0.05, 0.05, 0.5),
    numberParameter('hiddenUnits', '递归隐藏单元数', 32, 4),
    numberParameter('spectralRadius', '递归谱半径', 0.85, 0.1, 0.05, 0.99),
    numberParameter('alpha', '输出层正则强度', 1, 0.0001, 0.01)
  ],
  lstmForecast: [
    numberParameter('hiddenUnits', '记忆单元数', 24, 4),
    numberParameter('forgetBias', '遗忘门偏置', 1, 0, 0.1),
    numberParameter('alpha', '输出层正则强度', 0.1, 0.0001, 0.01),
    numberParameter('horizon', '预测步数', 3, 1)
  ],
  textTokenizer: [
    numberParameter('minTokenLength', '最短词元长度', 1, 1),
    booleanParameter('lowercase', '英文转为小写', true)
  ],
  informationExtraction: [
    booleanParameter('extractEmail', '抽取邮箱', true),
    booleanParameter('extractPhone', '抽取电话', true),
    booleanParameter('extractDate', '抽取日期', true),
    booleanParameter('extractNumber', '抽取数值', true)
  ],
  textFiltering: [
    numberParameter('minTokenLength', '最短词元长度', 1, 1),
    booleanParameter('removeUrls', '移除链接', true),
    booleanParameter('removeStopwords', '移除常见停用词', true)
  ],
  vectorSpaceModel: [
    numberParameter('maxFeatures', '最大词汇数', 1000, 10, 10),
    numberParameter('ngramMax', '最大 N-Gram', 1, 1, 1, 2)
  ],
  keywordExtraction: [
    numberParameter('topK', '每条文本关键词数量', 5, 1),
    numberParameter('maxFeatures', '最大词汇数', 2000, 10, 10)
  ],
  namedEntityRecognition: [
    booleanParameter('includeDates', '识别日期实体', true),
    booleanParameter('includeNumbers', '识别数值实体', true),
    booleanParameter('includeOrganizations', '识别组织机构', true)
  ],
  textSimilarity: [
    numberParameter('maxFeatures', '最大词汇数', 2000, 10, 10),
    numberParameter('ngramMax', '最大 N-Gram', 2, 1, 1, 2)
  ],
  sentimentAnalysis: [
    numberParameter('neutralThreshold', '中性阈值', 0, 0, 0.1)
  ],
  textClassifier: [
    numberParameter('testSize', '测试集比例', 0.2, 0.05, 0.05, 0.5),
    numberParameter('maxFeatures', '最大词汇数', 3000, 10, 10),
    numberParameter('regularization', '正则化强度 C', 1, 0.01, 0.01)
  ],
  topicModeling: [
    numberParameter('nTopics', '主题数量', 5, 2),
    numberParameter('maxFeatures', '最大词汇数', 3000, 10, 10),
    numberParameter('maxIterations', '最大迭代次数', 300, 50, 50)
  ],
  autoHyperparameterSearch: [
    numberParameter('testSize', '测试集比例', 0.2, 0.05, 0.05, 0.5),
    numberParameter('maxCandidates', '最大候选方案数', 8, 2)
  ],
  autoClassification: [
    numberParameter('testSize', '测试集比例', 0.2, 0.05, 0.05, 0.5)
  ],
  autoRegression: [
    numberParameter('testSize', '测试集比例', 0.2, 0.05, 0.05, 0.5)
  ],
  autoClustering: [
    numberParameter('minClusters', '最少聚类数', 2, 2),
    numberParameter('maxClusters', '最多聚类数', 8, 2)
  ],
  oneClickModeling: [
    numberParameter('testSize', '测试集比例', 0.2, 0.05, 0.05, 0.5),
    numberParameter('maxCandidates', '最大候选算法数', 6, 2),
    booleanParameter('autoTarget', '未选目标时使用最后一列', true)
  ]
};

export function defaultOutputColumn(id: string, kind: string): string {
  const prefix = id.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
  if (kind === 'classification') return `${prefix}_prediction`;
  if (kind === 'regression') return `${prefix}_prediction`;
  if (kind === 'clustering') return `${prefix}_cluster`;
  if (kind === 'association') return `${prefix}_rule`;
  if (kind === 'timeseries') return `${prefix}_fitted`;
  if (kind === 'evaluation') return `${prefix}_score`;
  if (kind === 'recommendation') return `${prefix}_score`;
  if (kind === 'ensemble') return `${prefix}_prediction`;
  if (kind === 'deeplearning') return `${prefix}_prediction`;
  if (kind === 'text') return `${prefix}_result`;
  if (kind === 'autolearning') return `${prefix}_prediction`;
  return `${prefix}_output`;
}
