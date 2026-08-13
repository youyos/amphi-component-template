export type AlgorithmKind =
  | 'classification'
  | 'clustering'
  | 'regression'
  | 'association'
  | 'timeseries'
  | 'evaluation'
  | 'recommendation'
  | 'ensemble'
  | 'deeplearning'
  | 'text'
  | 'autolearning';

export type AlgorithmDefinition = {
  id: string;
  name: string;
  category: string;
  kind: AlgorithmKind;
  description: string;
};

const classification: AlgorithmDefinition[] = [
  ['c45PlusClassifier', 'C4.5+ 决策树分类', '基于信息增益率思想的可解释决策树分类。'],
  ['xgboostClassifier', 'XGBoost 分类', '梯度提升分类；XGBoost 不可用时使用直方图梯度提升。'],
  ['knnClassifier', 'KNN 分类', '基于邻近样本投票的分类算法。'],
  ['naiveBayesClassifier', '朴素贝叶斯分类', '支持数值与类别特征的高斯朴素贝叶斯分类。'],
  ['bpNeuralClassifier', 'BP 神经网络分类', '多层感知机反向传播分类。'],
  ['lhalfSparseClassifier', 'L1/2 稀疏迭代分类', '迭代重加权近似 L1/2 稀疏分类。'],
  ['logisticClassifier', '逻辑回归分类', '带正则化的逻辑回归分类。'],
  ['svmClassifier', '支持向量机分类', 'RBF 核支持向量机分类。'],
  ['randomForestClassifier', '随机森林分类', '多棵随机决策树集成分类。'],
  ['gradientBoostingClassifier', '梯度提升树分类', '梯度提升决策树分类。']
].map(([id, name, description]) => ({ id, name, description, category: '机器学习组件', kind: 'classification' }));

const clustering: AlgorithmDefinition[] = [
  ['kmeansClustering', 'KMeans 聚类', '基于质心的 KMeans 聚类。'],
  ['emClustering', 'EM 高斯混合聚类', '使用期望最大化估计高斯混合模型。'],
  ['twoStepClustering', '两步聚类', '先微簇压缩、再进行层次聚类。'],
  ['fuzzyCMeansClustering', '模糊 C 均值聚类', '输出最大隶属度对应的模糊聚类标签。'],
  ['visualClustering', '视觉聚类', '基于二维投影与密度结构的视觉聚类。'],
  ['dbscanClustering', 'DBSCAN 密度聚类', '可识别噪声点的密度聚类。'],
  ['agglomerativeClustering', '层次聚类', '自底向上的凝聚层次聚类。'],
  ['spectralClustering', '谱聚类', '利用相似图谱分解发现非凸簇。']
].map(([id, name, description]) => ({ id, name, description, category: '机器学习组件', kind: 'clustering' }));

const regression: AlgorithmDefinition[] = [
  ['linearRegression', '线性回归', '普通最小二乘线性回归。'],
  ['svmRegression', 'SVM 回归', 'RBF 核支持向量回归。'],
  ['gradientBoostingRegression', '梯度提升树回归', '梯度提升决策树回归。'],
  ['bpNeuralRegression', 'BP 神经网络回归', '多层感知机反向传播回归。'],
  ['isotonicRegression', '保序回归', '保持单调关系的一元回归。'],
  ['lhalfSparseRegression', 'L1/2 稀疏迭代回归', '迭代重加权近似 L1/2 稀疏回归。'],
  ['ridgeRegression', '岭回归', '使用 L2 正则化的线性回归。'],
  ['lassoRegression', 'Lasso 回归', '使用 L1 正则化的稀疏线性回归。'],
  ['randomForestRegression', '随机森林回归', '随机森林集成回归。'],
  ['elasticNetRegression', '弹性网络回归', '组合 L1 与 L2 正则化的回归。']
].map(([id, name, description]) => ({ id, name, description, category: '机器学习组件', kind: 'regression' }));

const association: AlgorithmDefinition[] = [
  ['aprioriAssociation', 'Apriori 关联规则', '基于候选项集逐层搜索的关联规则挖掘。'],
  ['fpGrowthAssociation', 'FP-Growth 关联规则', '按频繁模式增长思想挖掘关联规则。'],
  ['eclatAssociation', 'Eclat 关联规则', '基于事务集合交集的频繁项集挖掘。'],
  ['weightedAssociation', '加权关联规则', '支持按数值权重统计的关联规则。'],
  ['sequentialPatternAssociation', '序列模式关联', '按记录顺序发现相邻项目模式。']
].map(([id, name, description]) => ({ id, name, description, category: '机器学习组件', kind: 'association' }));

const timeseries: AlgorithmDefinition[] = [
  ['arimaForecast', 'ARIMA 时间序列', '自回归差分移动平均预测。'],
  ['sparseTimeSeriesForecast', '稀疏时间序列', '基于稀疏滞后特征的时间序列预测。'],
  ['exponentialSmoothingForecast', '指数平滑', 'Holt 指数平滑趋势预测。'],
  ['greyForecast', '灰色预测 GM(1,1)', '适合小样本趋势序列的灰色预测。'],
  ['echoStateNetworkForecast', '回声状态网络', '固定随机储备池与线性读出的预测模型。'],
  ['movingAverageForecast', '移动平均预测', '使用滚动均值进行稳健基线预测。'],
  ['holtWintersForecast', 'Holt-Winters 预测', '带趋势与季节项的三次指数平滑。'],
  ['linearTrendForecast', '线性趋势预测', '根据时间索引拟合确定性线性趋势。']
].map(([id, name, description]) => ({ id, name, description, category: '机器学习组件', kind: 'timeseries' }));

const evaluation: AlgorithmDefinition[] = [
  ['entropyWeightEvaluation', '熵值法综合评价', '根据信息熵客观确定指标权重。'],
  ['ahpEvaluation', '层次分析法 AHP', '根据成对比较矩阵计算主观权重。'],
  ['fuzzyComprehensiveEvaluation', '模糊综合评价法', '通过归一化隶属度聚合多指标得分。'],
  ['topsisEvaluation', 'TOPSIS 综合评价', '根据正负理想解距离进行排序。'],
  ['pcaEvaluation', '主成分综合评价', '利用第一主成分载荷形成综合得分。']
].map(([id, name, description]) => ({ id, name, description, category: '机器学习组件', kind: 'evaluation' }));

const recommendation: AlgorithmDefinition[] = [
  ['userCollaborativeFiltering', '基于用户的协同过滤', '根据相似用户偏好预测评分。'],
  ['itemCollaborativeFiltering', '基于物品的协同过滤', '根据相似物品关系预测评分。'],
  ['matrixFactorizationRecommendation', '矩阵分解推荐', '使用低秩矩阵分解补全用户物品评分。'],
  ['popularityRecommendation', '热门度推荐', '根据物品交互次数与平均评分排序。'],
  ['contentBasedRecommendation', '基于内容的推荐', '结合物品属性相似度生成推荐分数。']
].map(([id, name, description]) => ({ id, name, description, category: '机器学习组件', kind: 'recommendation' }));

const ensemble: AlgorithmDefinition[] = [
  ['baggingClassifier', 'Bagging 分类', '通过有放回抽样训练多个分类器并进行集成投票。'],
  ['baggingRegressor', 'Bagging 回归', '通过有放回抽样训练多个回归器并平均预测结果。'],
  ['votingClassifier', 'Voting 分类', '融合逻辑回归、随机森林和支持向量机的分类结果。'],
  ['votingRegressor', 'Voting 回归', '融合线性回归、随机森林和梯度提升回归结果。']
].map(([id, name, description]) => ({ id, name, description, category: '集成学习组件', kind: 'ensemble' }));

const deeplearning: AlgorithmDefinition[] = [
  ['dnnClassifier', 'DNN 深度神经网络分类', '使用多隐藏层全连接神经网络完成分类。'],
  ['dnnRegressor', 'DNN 深度神经网络回归', '使用多隐藏层全连接神经网络完成回归。'],
  ['rnnClassifier', 'RNN 循环神经网络分类', '使用递归隐藏状态提取序列特征并完成分类。'],
  ['rnnRegressor', 'RNN 循环神经网络回归', '使用递归隐藏状态提取序列特征并完成回归。'],
  ['lstmForecast', 'LSTM 长短期记忆预测', '使用轻量 LSTM 门控状态进行时间序列预测。']
].map(([id, name, description]) => ({ id, name, description, category: '深度学习组件', kind: 'deeplearning' }));

const text: AlgorithmDefinition[] = [
  ['textTokenizer', '文本分词', '对中英文文本进行基础分词并输出空格分隔词元。'],
  ['informationExtraction', '文本信息抽取', '从文本中抽取邮箱、电话、日期和数值信息。'],
  ['textFiltering', '文本过滤', '清理链接、邮箱、标点及停用词，输出规范化文本。'],
  ['vectorSpaceModel', '文本向量空间', '使用 TF-IDF 构建文本向量空间。'],
  ['keywordExtraction', '关键词提取', '根据 TF-IDF 权重抽取每条文本的关键词。'],
  ['namedEntityRecognition', '命名实体识别', '识别人名候选、组织机构、日期和数值实体。'],
  ['textSimilarity', '文本相似度', '计算两列文本之间的 TF-IDF 余弦相似度。'],
  ['sentimentAnalysis', '观点情感分析', '根据中英文情感词典计算观点情感倾向。'],
  ['textClassifier', '文本分类', '使用 TF-IDF 与逻辑回归训练文本分类模型。'],
  ['topicModeling', '文本主题建模', '使用非负矩阵分解发现文本主题。']
].map(([id, name, description]) => ({ id, name, description, category: '文本分析组件', kind: 'text' }));

const autolearning: AlgorithmDefinition[] = [
  ['autoHyperparameterSearch', '自动择参', '根据任务类型自动搜索候选算法及超参数。'],
  ['autoClassification', '自动分类', '自动完成预处理、候选分类算法比较和模型评估。'],
  ['autoRegression', '自动回归', '自动完成预处理、候选回归算法比较和模型评估。'],
  ['autoClustering', '自动聚类', '自动比较不同聚类数量并选择最优轮廓系数方案。'],
  ['oneClickModeling', '一键建模', '输入数据后自动完成处理、特征工程、任务识别、算法选择和模型评估。']
].map(([id, name, description]) => ({ id, name, description, category: '自动学习组件', kind: 'autolearning' }));

export const algorithmCatalog: AlgorithmDefinition[] = [
  ...classification,
  ...clustering,
  ...regression,
  ...association,
  ...timeseries,
  ...evaluation,
  ...recommendation,
  ...ensemble,
  ...deeplearning,
  ...text,
  ...autolearning
];
