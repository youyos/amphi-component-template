import { algorithmCatalog, AlgorithmDefinition } from './algorithmCatalog';
import { iconForAlgorithm } from './algorithmIcons';
import {
  algorithmParameters,
  defaultOutputColumn
} from './algorithmParameters';
import { algorithmRuntime } from './algorithmRuntime';
import { pythonOptionsLiteral } from './pythonLiteral';

function parametersFor(definition: AlgorithmDefinition) {
  const parameters = [...(algorithmParameters[definition.id] ?? [])];
  if (
    (definition.kind === 'classification' ||
      definition.kind === 'regression') &&
    !parameters.some(parameter => parameter.key === 'testSize')
  ) {
    parameters.unshift({
      key: 'testSize',
      label: '测试集比例',
      type: 'inputNumber' as const,
      defaultValue: 0.2,
      min: 0.05,
      max: 0.5,
      step: 0.05,
      advanced: false
    });
  }
  return parameters;
}

function formLabels(definition: AlgorithmDefinition) {
  if (definition.kind === 'ensemble') {
    return {
      target: '目标列',
      targetPlaceholder: '选择分类标签或回归目标',
      features: '特征列',
      output: '集成预测字段'
    };
  }
  if (definition.kind === 'deeplearning') {
    return {
      target: definition.id === 'lstmForecast' ? '数值序列列' : '目标列',
      targetPlaceholder:
        definition.id === 'lstmForecast'
          ? '选择需要预测的数值序列'
          : '选择分类标签或回归目标',
      features:
        definition.id === 'lstmForecast' ? '时间/辅助列（可选）' : '特征列',
      output: '深度学习预测字段'
    };
  }
  if (definition.kind === 'text') {
    if (definition.id === 'textClassifier') {
      return {
        target: '分类标签列',
        targetPlaceholder: '选择文本分类标签',
        features: '文本列',
        output: '文本预测类别字段'
      };
    }
    if (definition.id === 'textSimilarity') {
      return {
        target: '文本列 A',
        targetPlaceholder: '选择第一段文本',
        features: '文本列 B',
        output: '文本相似度字段'
      };
    }
    return {
      target: '文本列',
      targetPlaceholder: '选择需要分析的文本字段',
      features: '辅助文本列（可选）',
      output: '文本分析结果字段'
    };
  }
  if (definition.kind === 'autolearning') {
    return {
      target:
        definition.id === 'autoClustering' ? '目标列（不需要）' : '目标列',
      targetPlaceholder:
        definition.id === 'oneClickModeling'
          ? '可不选；系统将自动使用最后一列'
          : '选择监督学习目标列',
      features: '候选特征列（留空自动选择）',
      output: '自动学习预测字段'
    };
  }
  if (definition.kind === 'association') {
    return {
      target: '事务项目列',
      targetPlaceholder: '每行使用逗号分隔项目，也支持列表值',
      features: '辅助列（可选）',
      output: '最优规则字段'
    };
  }
  if (definition.kind === 'timeseries') {
    return {
      target: '数值序列列',
      targetPlaceholder: '选择需要预测的数值列',
      features: '时间/辅助列（可选）',
      output: '拟合值字段'
    };
  }
  if (definition.kind === 'recommendation') {
    return {
      target: '用户列',
      targetPlaceholder: '选择用户标识字段',
      features: '物品列、评分列',
      output: '推荐得分字段'
    };
  }
  if (definition.kind === 'evaluation') {
    return {
      target: '目标列（可选）',
      targetPlaceholder: '综合评价通常不需要目标列',
      features: '评价指标列',
      output: '综合得分字段'
    };
  }
  if (definition.kind === 'clustering') {
    return {
      target: '目标列（可选）',
      targetPlaceholder: '无监督聚类不需要目标列',
      features: '聚类特征列',
      output: '聚类标签字段'
    };
  }
  return {
    target: '目标列',
    targetPlaceholder: '选择训练目标；缺失目标行将保留并预测',
    features: '特征列',
    output: definition.kind === 'classification' ? '预测类别字段' : '预测值字段'
  };
}

class ZeroCodeAlgorithmComponent extends (globalThis as any).Amphi.BaseCoreComponent {
  private readonly definition: AlgorithmDefinition;

  constructor(definition: AlgorithmDefinition) {
    const labels = formLabels(definition);
    const parameterDefinitions = parametersFor(definition);
    const outputColumn = defaultOutputColumn(definition.id, definition.kind);
    const defaultConfig = {
      mlTargetColumn: [],
      mlFeatureColumns: [],
      mlRandomSeed: 42,
      ...Object.fromEntries(
        parameterDefinitions.map(parameter => [
          `mlOption_${parameter.key}`,
          parameter.defaultValue
        ])
      )
    };
    const targetRequired =
      definition.kind === 'classification' ||
      definition.kind === 'regression' ||
      definition.kind === 'association' ||
      definition.kind === 'timeseries' ||
      definition.kind === 'recommendation' ||
      definition.kind === 'ensemble' ||
      definition.kind === 'deeplearning' ||
      definition.kind === 'text' ||
      (definition.kind === 'autolearning' &&
        definition.id !== 'autoClustering' &&
        definition.id !== 'oneClickModeling');
    const featuresRequired =
      definition.kind === 'recommendation' ||
      definition.id === 'textClassifier' ||
      definition.id === 'textSimilarity';
    const form = {
      idPrefix: `amphi_${definition.id}`,
      fields: [
        {
          type: 'info',
          id: 'mlInfo',
          text: `${definition.description} 预测结果自动写入 ${outputColumn}；同时输出模型对象和指标字典。`,
          advanced: false
        },
        {
          type: 'column',
          label: labels.target,
          id: 'mlTargetColumn',
          placeholder: labels.targetPlaceholder,
          required: targetRequired,
          advanced: false
        },
        {
          type: 'columns',
          label: labels.features,
          id: 'mlFeatureColumns',
          placeholder: '留空时自动选择适用的数值列',
          required: featuresRequired,
          advanced: false
        },
        ...parameterDefinitions.map(parameter => ({
          type: parameter.type,
          label: parameter.label,
          id: `mlOption_${parameter.key}`,
          min: parameter.min,
          max: parameter.max,
          step: parameter.step,
          advanced: parameter.advanced ?? false
        })),
        {
          type: 'inputNumber',
          label: '随机种子',
          id: 'mlRandomSeed',
          min: 0,
          step: 1,
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
      definition.category,
      iconForAlgorithm(definition.id, definition.kind),
      defaultConfig,
      form
    );
    this.definition = definition;
  }

  provideImports() {
    return ['import numpy as np', 'import pandas as pd'];
  }

  provideFunctions() {
    return [algorithmRuntime];
  }

  generateComponentCode({ config, inputName, outputName }) {
    const targetColumn = config?.mlTargetColumn?.value ?? '';
    const featureColumns = Array.isArray(config?.mlFeatureColumns)
      ? config.mlFeatureColumns.map(item => item?.value).filter(Boolean)
      : [];
    const parameterDefinitions = parametersFor(this.definition);
    const options = Object.fromEntries(
      parameterDefinitions.map(parameter => {
        const configured = config?.[`mlOption_${parameter.key}`];
        const value =
          parameter.type === 'boolean'
            ? Boolean(configured ?? parameter.defaultValue)
            : Number(configured ?? parameter.defaultValue);
        return [
          parameter.key,
          typeof value === 'number' && !Number.isFinite(value)
            ? parameter.defaultValue
            : value
        ];
      })
    );
    const outputColumn = defaultOutputColumn(
      this.definition.id,
      this.definition.kind
    );
    const randomSeed = Number(config?.mlRandomSeed ?? 42);
    const optionsLiteral = pythonOptionsLiteral(options);
    return `
${outputName}, ${outputName}_model, ${outputName}_metrics = run_amphi_zero_code_algorithm(
    dataframe=${inputName},
    algorithm=${JSON.stringify(this.definition.id)},
    kind=${JSON.stringify(this.definition.kind)},
    target_column=${JSON.stringify(targetColumn)},
    feature_columns=${JSON.stringify(featureColumns)},
    output_column=${JSON.stringify(outputColumn)},
    options=${optionsLiteral},
    random_seed=${Number.isFinite(randomSeed) ? Math.trunc(randomSeed) : 42}
)
`.trim();
  }
}

export const algorithmComponents = new Map(
  algorithmCatalog.map(definition => [
    definition.id,
    new ZeroCodeAlgorithmComponent(definition)
  ])
);
