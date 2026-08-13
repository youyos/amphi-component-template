const algorithmAbbreviations: Record<string, string> = {
  c45PlusClassifier: 'C4.5',
  xgboostClassifier: 'XGB',
  knnClassifier: 'KNN',
  naiveBayesClassifier: 'NB',
  bpNeuralClassifier: 'BP',
  lhalfSparseClassifier: 'L1/2',
  logisticClassifier: 'LOG',
  svmClassifier: 'SVM',
  randomForestClassifier: 'RF',
  gradientBoostingClassifier: 'GBT',
  kmeansClustering: 'KM',
  emClustering: 'EM',
  twoStepClustering: '2STEP',
  fuzzyCMeansClustering: 'FCM',
  visualClustering: 'VIS',
  dbscanClustering: 'DBS',
  agglomerativeClustering: 'HAC',
  spectralClustering: 'SPEC',
  linearRegression: 'LIN',
  svmRegression: 'SVR',
  gradientBoostingRegression: 'GBR',
  bpNeuralRegression: 'BPR',
  isotonicRegression: 'ISO',
  lhalfSparseRegression: 'L1/2R',
  ridgeRegression: 'RID',
  lassoRegression: 'LAS',
  randomForestRegression: 'RFR',
  elasticNetRegression: 'ENET',
  aprioriAssociation: 'APR',
  fpGrowthAssociation: 'FPG',
  eclatAssociation: 'ECL',
  weightedAssociation: 'WAR',
  sequentialPatternAssociation: 'SEQ',
  arimaForecast: 'ARIMA',
  sparseTimeSeriesForecast: 'STS',
  exponentialSmoothingForecast: 'EXP',
  greyForecast: 'GM',
  echoStateNetworkForecast: 'ESN',
  movingAverageForecast: 'MA',
  holtWintersForecast: 'HW',
  linearTrendForecast: 'TREND',
  entropyWeightEvaluation: 'ENT',
  ahpEvaluation: 'AHP',
  fuzzyComprehensiveEvaluation: 'FCE',
  topsisEvaluation: 'TOP',
  pcaEvaluation: 'PCA',
  userCollaborativeFiltering: 'UCF',
  itemCollaborativeFiltering: 'ICF',
  matrixFactorizationRecommendation: 'MF',
  popularityRecommendation: 'HOT',
  contentBasedRecommendation: 'CBR',
  baggingClassifier: 'BAG-C',
  baggingRegressor: 'BAG-R',
  votingClassifier: 'VOT-C',
  votingRegressor: 'VOT-R',
  dnnClassifier: 'DNN-C',
  dnnRegressor: 'DNN-R',
  rnnClassifier: 'RNN-C',
  rnnRegressor: 'RNN-R',
  lstmForecast: 'LSTM',
  textTokenizer: 'TOK',
  informationExtraction: 'INFO',
  textFiltering: 'FILT',
  vectorSpaceModel: 'VSM',
  keywordExtraction: 'KEY',
  namedEntityRecognition: 'NER',
  textSimilarity: 'SIM',
  sentimentAnalysis: 'SENT',
  textClassifier: 'TXT-C',
  topicModeling: 'TOPIC',
  autoHyperparameterSearch: 'AUTO-P',
  autoClassification: 'AUTO-C',
  autoRegression: 'AUTO-R',
  autoClustering: 'AUTO-K',
  oneClickModeling: '1CLICK'
};

const categoryMotifs: Record<string, string> = {
  classification:
    '<path d="M12 3v3M7 9h10M7 9v3M12 9v3M17 9v3"/><circle cx="12" cy="3" r="1.4" fill="currentColor"/><circle cx="7" cy="13" r="1.4" fill="currentColor"/><circle cx="12" cy="13" r="1.4" fill="currentColor"/><circle cx="17" cy="13" r="1.4" fill="currentColor"/>',
  clustering:
    '<circle cx="7" cy="7" r="2"/><circle cx="12" cy="5" r="1.5"/><circle cx="17" cy="8" r="2"/><circle cx="10" cy="11" r="1.5"/><path d="M5 4c3-2 7-2 9 0M14 11c2 1 4 1 6-1" fill="none"/>',
  regression:
    '<path d="M4 13V4M4 13h16M6 11l4-3 3 1 6-5" fill="none"/><circle cx="6" cy="11" r="1"/><circle cx="10" cy="8" r="1"/><circle cx="13" cy="9" r="1"/><circle cx="19" cy="4" r="1"/>',
  association:
    '<path d="M7 6l5 3 5-3M7 6v6M17 6v6M7 12l5-3 5 3" fill="none"/><circle cx="7" cy="6" r="2"/><circle cx="17" cy="6" r="2"/><circle cx="7" cy="12" r="2"/><circle cx="17" cy="12" r="2"/>',
  timeseries:
    '<path d="M3 9h3l2-5 3 9 3-7 2 3h5" fill="none"/><path d="M3 13h18" fill="none" opacity=".45"/>',
  evaluation:
    '<path d="M12 2l2.2 4.5 5 .7-3.6 3.5.8 2.3H7.6l.8-2.3-3.6-3.5 5-.7L12 2Z" fill="none"/><path d="M9 9.5l2 2 4-4" fill="none"/>',
  recommendation:
    '<path d="M12 13S5 9.2 5 5.8C5 3.7 7.6 2.7 9 4.4L12 7l3-2.6c1.4-1.7 4-.7 4 1.4 0 3.4-7 7.2-7 7.2Z" fill="none"/><path d="M8 9l4 2 4-2" fill="none" opacity=".5"/>',
  ensemble:
    '<rect x="4" y="4" width="7" height="7" rx="1"/><rect x="8.5" y="6.5" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><path d="M7.5 13h9" fill="none"/>',
  deeplearning:
    '<circle cx="5" cy="5" r="1.4"/><circle cx="5" cy="11" r="1.4"/><circle cx="12" cy="4" r="1.4"/><circle cx="12" cy="8" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="8" r="1.4"/><path d="M6.4 5l4.2-1M6.4 5l4.2 3M6.4 11l4.2-3M6.4 11l4.2 1M13.4 4l4.2 4M13.4 8h4.2M13.4 12l4.2-4" fill="none"/>',
  text:
    '<path d="M6 3h9l3 3v8H6V3Z" fill="none"/><path d="M15 3v4h3M8 8h5M8 11h8" fill="none"/>',
  autolearning:
    '<path d="M5 13L15 3M13.5 2.5l2 2M17 7v3M15.5 8.5h3M7 4V7M5.5 5.5h3" fill="none"/><path d="M9 10l3 3" fill="none"/>'
};

export function iconForAlgorithm(id: string, kind: string) {
  const abbreviation = algorithmAbbreviations[id];
  if (!abbreviation) {
    throw new Error(`Missing icon abbreviation for algorithm ${id}.`);
  }
  const motif = categoryMotifs[kind];
  if (!motif) {
    throw new Error(`Missing icon motif for algorithm kind ${kind}.`);
  }
  const fontSize =
    abbreviation.length >= 5 ? 4.2 : abbreviation.length === 4 ? 4.8 : 5.5;
  return {
    name: `amphi-${id}-icon`,
    svgstr:
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" ` +
      `fill="none" stroke="currentColor" stroke-width="1.35" ` +
      `stroke-linecap="round" stroke-linejoin="round">` +
      `<rect x="1.5" y="1.5" width="21" height="21" rx="4"/>${motif}` +
      `<text x="12" y="20" fill="currentColor" stroke="none" ` +
      `font-family="Arial,sans-serif" font-size="${fontSize}" ` +
      `font-weight="700" text-anchor="middle">${abbreviation}</text></svg>`
  };
}

export const algorithmIconIds = Object.keys(algorithmAbbreviations);
