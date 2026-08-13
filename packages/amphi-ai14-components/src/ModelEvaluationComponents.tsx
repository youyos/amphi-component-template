import {
  buildBestModelCode,
  buildEvaluationCode,
  buildModelExportCode,
  buildModelReadCode,
  buildModelUseCode,
  EvaluationMethod
} from './modelEvaluationCode';
import { modelEvaluationRuntime } from './modelEvaluationRuntime';

const COMPONENT_CATEGORY = '模型评估与管理组件';

type EvaluationDefinition = {
  id: string;
  name: string;
  method: EvaluationMethod;
  description: string;
  requiresScore: boolean;
  iconLabel: string;
  iconPath: string;
};

const evaluationDefinitions: EvaluationDefinition[] = [
  {
    id: 'ksModelEvaluation',
    name: 'K-S 模型评估',
    method: 'ks',
    description: '计算二分类模型的 K-S 统计量、最优阈值及累计正负样本曲线。',
    requiresScore: true,
    iconLabel: 'KS',
    iconPath: 'M3 19h18v2H3v-2Zm2-3 4-5 3 3 6-9 2 1-8 12-3-3-2 3-2-2Z'
  },
  {
    id: 'prModelEvaluation',
    name: 'PR 模型评估',
    method: 'pr',
    description: '生成精确率-召回率曲线，并计算平均精确率 Average Precision。',
    requiresScore: true,
    iconLabel: 'PR',
    iconPath: 'M4 4h2v14h14v2H4V4Zm4 11 3-5 3 2 4-6 2 1-5 8-3-2-2 4-2-2Z'
  },
  {
    id: 'rocModelEvaluation',
    name: 'ROC 模型评估',
    method: 'roc',
    description: '生成 ROC 曲线，并计算二分类模型的曲线下面积 AUC。',
    requiresScore: true,
    iconLabel: 'ROC',
    iconPath: 'M4 20V4h2v13.5C10 16 12 11 14 8c2-3 4-4 6-4v2c-1 0-3 1-4.5 3.5C13 14 10 18 6 20H4Z'
  },
  {
    id: 'classificationModelEvaluation',
    name: '分类模型综合评估',
    method: 'classification',
    description: '计算准确率、平衡准确率、加权精确率、召回率和 F1。',
    requiresScore: false,
    iconLabel: 'F1',
    iconPath: 'M3 5h8v6H3V5Zm10 0h8v6h-8V5ZM3 13h8v6H3v-6Zm10 0h8v6h-8v-6Z'
  },
  {
    id: 'regressionModelEvaluation',
    name: '回归模型综合评估',
    method: 'regression',
    description: '计算 MAE、MSE、RMSE、R² 和 MAPE 回归评估指标。',
    requiresScore: false,
    iconLabel: 'R²',
    iconPath: 'M3 18h18v2H3v-2Zm2-3 4-4 3 2 6-8 2 1-7 10-4-2-3 3-1-2Z'
  }
];

function componentIcon(
  id: string,
  label: string,
  path: string
): { name: string; svgstr: string } {
  return {
    name: `amphi-ai14-${id}-icon`,
    svgstr: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="${path}"/><text x="12" y="11" text-anchor="middle" font-size="4" font-weight="700" fill="currentColor">${label}</text></svg>`
  };
}

class EvaluationComponent extends (globalThis as any).Amphi.BaseCoreComponent {
  private readonly method: EvaluationMethod;

  constructor(definition: EvaluationDefinition) {
    const defaultConfig = {
      ai14TargetColumn: [],
      ai14PredictionColumn: [],
      ai14ScoreColumn: [],
      ai14PositiveLabel: '',
      ai14ModelName: definition.name,
      ai14ModelPath: ''
    };
    const fields: any[] = [
      {
        type: 'info',
        id: 'ai14EvaluationInfo',
        text: `${definition.description} 输出标准化评估 DataFrame，可继续连接“最优模型选择”。`,
        advanced: false
      },
      {
        type: 'column',
        label: '真实值字段',
        id: 'ai14TargetColumn',
        required: true,
        advanced: false
      }
    ];
    if (definition.requiresScore) {
      fields.push(
        {
          type: 'column',
          label: '概率/评分字段',
          id: 'ai14ScoreColumn',
          required: true,
          advanced: false
        },
        {
          type: 'input',
          label: '正类标签（可选）',
          id: 'ai14PositiveLabel',
          placeholder: '留空自动选择排序后的最后一类',
          advanced: false
        }
      );
    } else {
      fields.push({
        type: 'column',
        label: '模型预测字段',
        id: 'ai14PredictionColumn',
        required: true,
        advanced: false
      });
    }
    fields.push(
      {
        type: 'input',
        label: '模型名称',
        id: 'ai14ModelName',
        required: true,
        advanced: false
      },
      {
        type: 'input',
        label: '模型文件路径（可选）',
        id: 'ai14ModelPath',
        placeholder: '用于把最优评估结果关联到模型文件',
        advanced: true
      }
    );
    const form = {
      idPrefix: `amphi_ai14_${definition.id}`,
      fields
    };
    super(
      definition.name,
      definition.id,
      definition.description,
      'pandas_df_processor',
      [],
      COMPONENT_CATEGORY,
      componentIcon(
        definition.id,
        definition.iconLabel,
        definition.iconPath
      ),
      defaultConfig,
      form
    );
    this.method = definition.method;
  }

  provideImports() {
    return [];
  }

  provideFunctions() {
    return [modelEvaluationRuntime];
  }

  generateComponentCode({ config, inputName, outputName }) {
    return buildEvaluationCode(this.method, config, inputName, outputName);
  }
}

class BestModelSelectionComponent extends (globalThis as any).Amphi
  .BaseCoreComponent {
  constructor() {
    const defaultConfig = {
      ai14MetricColumn: [],
      ai14ModelColumn: [],
      ai14PathColumn: [],
      ai14Direction: 'auto'
    };
    const form = {
      idPrefix: 'amphi_ai14_best_model',
      fields: [
        {
          type: 'info',
          id: 'ai14BestInfo',
          text: '对多个模型的评估结果排序，输出模型名次并标记唯一最优模型。曲线类评估会自动按模型去重。',
          advanced: false
        },
        {
          type: 'column',
          label: '评估指标字段',
          id: 'ai14MetricColumn',
          placeholder: '留空默认 metric_value',
          advanced: false
        },
        {
          type: 'column',
          label: '模型名称字段',
          id: 'ai14ModelColumn',
          placeholder: '留空默认 model_name',
          advanced: false
        },
        {
          type: 'column',
          label: '模型路径字段',
          id: 'ai14PathColumn',
          placeholder: '留空默认 model_path',
          advanced: true
        },
        {
          type: 'radio',
          label: '最优方向',
          id: 'ai14Direction',
          options: [
            { value: 'auto', label: '自动判断' },
            { value: 'max', label: '越大越优' },
            { value: 'min', label: '越小越优' }
          ],
          advanced: false
        }
      ]
    };
    super(
      '最优模型选择',
      'bestModelSelection',
      '根据指定评估指标比较候选模型并标记最优模型。',
      'pandas_df_processor',
      [],
      COMPONENT_CATEGORY,
      componentIcon(
        'best-model-selection',
        'BEST',
        'M12 2 15 8l7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1 3-6Z'
      ),
      defaultConfig,
      form
    );
  }

  provideImports() {
    return [];
  }

  provideFunctions() {
    return [modelEvaluationRuntime];
  }

  generateComponentCode({ config, inputName, outputName }) {
    return buildBestModelCode(config, inputName, outputName);
  }
}

class ModelArtifactExportComponent extends (globalThis as any).Amphi
  .BaseCoreComponent {
  constructor() {
    const defaultConfig = {
      ai14ModelVariable: '',
      ai14ModelOutputPath: 'models/amphi-model.joblib',
      ai14SerializationFormat: 'joblib'
    };
    const form = {
      idPrefix: 'amphi_ai14_model_export',
      fields: [
        {
          type: 'info',
          id: 'ai14ExportInfo',
          text: '直接连接建模组件即可自动找到其模型对象，保存后输出包含路径、SHA-256 和模型类型的描述 DataFrame。',
          advanced: false
        },
        {
          type: 'input',
          label: '模型输出路径',
          id: 'ai14ModelOutputPath',
          required: true,
          advanced: false
        },
        {
          type: 'radio',
          label: '序列化格式',
          id: 'ai14SerializationFormat',
          options: [
            { value: 'joblib', label: 'Joblib（推荐）' },
            { value: 'pickle', label: 'Pickle' },
            { value: 'auto', label: '按扩展名自动判断' }
          ],
          advanced: false
        },
        {
          type: 'input',
          label: '模型变量名（可选）',
          id: 'ai14ModelVariable',
          placeholder: '留空自动使用上游输出变量_model',
          advanced: true
        }
      ]
    };
    super(
      '模型输出',
      'modelArtifactExport',
      '把建模组件产生的模型对象保存为可迁移文件。',
      'pandas_df_processor',
      [],
      COMPONENT_CATEGORY,
      componentIcon(
        'model-artifact-export',
        'OUT',
        'M5 3h10l4 4v14H5V3Zm8 2v4h4l-4-4ZM8 13h3v-3h2v3h3l-4 4-4-4Z'
      ),
      defaultConfig,
      form
    );
  }

  provideImports() {
    return [];
  }

  provideFunctions() {
    return [modelEvaluationRuntime];
  }

  generateComponentCode({ config, inputName, outputName }) {
    return buildModelExportCode(config, inputName, outputName);
  }
}

class ModelArtifactInputComponent extends (globalThis as any).Amphi
  .BaseCoreComponent {
  constructor() {
    const defaultConfig = {
      ai14ModelInputPath: '',
      ai14RegistryKey: ''
    };
    const form = {
      idPrefix: 'amphi_ai14_model_input',
      fields: [
        {
          type: 'info',
          id: 'ai14InputInfo',
          text: '读取可信的 Joblib 或 Pickle 模型文件，并输出可连接“模型利用”的模型描述 DataFrame。',
          advanced: false
        },
        {
          type: 'file',
          label: '模型文件路径',
          id: 'ai14ModelInputPath',
          validation: '^.*\\.(joblib|pkl|pickle)$',
          required: true,
          advanced: false
        },
        {
          type: 'input',
          label: '模型注册名称（可选）',
          id: 'ai14RegistryKey',
          placeholder: '留空使用文件名',
          advanced: true
        }
      ]
    };
    super(
      '模型读取',
      'modelArtifactInput',
      '从模型文件读取模型对象并注册到当前流水线运行环境。',
      'pandas_df_input',
      ['joblib', 'pkl', 'pickle'],
      COMPONENT_CATEGORY,
      componentIcon(
        'model-artifact-input',
        'IN',
        'M5 3h10l4 4v14H5V3Zm8 2v4h4l-4-4Zm-1 6 4 4h-3v3h-2v-3H8l4-4Z'
      ),
      defaultConfig,
      form
    );
  }

  provideImports() {
    return [];
  }

  provideFunctions() {
    return [modelEvaluationRuntime];
  }

  generateComponentCode({ config, outputName }) {
    return buildModelReadCode(config, outputName);
  }
}

class ModelPredictionUseComponent extends (globalThis as any).Amphi
  .BaseCoreComponent {
  constructor() {
    const defaultConfig = {
      ai14FeatureColumns: [],
      ai14IncludeProbability: true
    };
    const form = {
      idPrefix: 'amphi_ai14_model_use',
      fields: [
        {
          type: 'info',
          id: 'ai14UseInfo',
          text: '连接一个待预测 DataFrame 和一个“模型读取/模型输出”的描述 DataFrame，自动输出 model_prediction。',
          advanced: false
        },
        {
          type: 'columns',
          label: '模型特征列（可选）',
          id: 'ai14FeatureColumns',
          placeholder: '留空优先使用模型保存的特征名',
          advanced: false
        },
        {
          type: 'boolean',
          label: '输出分类概率',
          id: 'ai14IncludeProbability',
          advanced: false
        }
      ]
    };
    super(
      '模型利用',
      'modelPredictionUse',
      '使用已读取或已输出的模型对新数据进行预测。',
      'pandas_df_double_processor',
      [],
      COMPONENT_CATEGORY,
      componentIcon(
        'model-prediction-use',
        'USE',
        'M4 4h7v7H4V4Zm9 0h7v7h-7V4ZM4 13h7v7H4v-7Zm11 0 5 3.5-5 3.5v-7Z'
      ),
      defaultConfig,
      form
    );
  }

  provideImports() {
    return [];
  }

  provideFunctions() {
    return [modelEvaluationRuntime];
  }

  generateComponentCode({ config, inputName1, inputName2, outputName }) {
    return buildModelUseCode(config, inputName1, inputName2, outputName);
  }
}

export const modelEvaluationComponents = new Map<string, unknown>([
  ...evaluationDefinitions.map(definition => [
    definition.id,
    new EvaluationComponent(definition)
  ] as [string, unknown]),
  ['bestModelSelection', new BestModelSelectionComponent()],
  ['modelArtifactExport', new ModelArtifactExportComponent()],
  ['modelArtifactInput', new ModelArtifactInputComponent()],
  ['modelPredictionUse', new ModelPredictionUseComponent()]
]);
