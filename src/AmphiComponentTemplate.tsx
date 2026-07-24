/*
 * 通用 pandas DataFrame 处理组件模板。
 *
 * 复制此文件并修改：
 * 1. 类名、组件显示名、组件 id、说明、分类和图标。
 * 2. defaultConfig 与 form.fields。
 * 3. provideImports、provideFunctions、generateComponentCode。
 * 4. 在 src/index.ts 的 componentDefinitions 中注册。
 */
class AmphiComponentTemplate extends (globalThis as any).Amphi.BaseCoreComponent {
  constructor() {
    const defaultConfig = {
      tplTargetColumn: [],
      tplFeatureColumns: [],
      tplMultiplier: 1,
      tplOutputColumn: "template_score"
    };

    const form = {
      idPrefix: "amphi_component_template",
      fields: [
        {
          type: "info",
          id: "tplInfo",
          text: "这是内置组件模板。替换表单字段和 Python 算法后即可开发新组件。",
          advanced: false
        },
        {
          type: "column",
          label: "目标列",
          id: "tplTargetColumn",
          placeholder: "分类/回归组件可保留，聚类组件可以删除",
          required: false,
          advanced: false
        },
        {
          type: "columns",
          label: "特征列",
          id: "tplFeatureColumns",
          placeholder: "留空表示使用全部数值字段",
          advanced: false
        },
        {
          type: "inputNumber",
          label: "示例倍数",
          id: "tplMultiplier",
          min: 0,
          step: 0.1,
          advanced: true
        },
        {
          type: "input",
          label: "输出字段",
          id: "tplOutputColumn",
          placeholder: "template_score",
          required: true,
          advanced: false
        }
      ]
    };

    const icon = {
      name: "amphi-component-template-icon",
      svgstr:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M4 3h16v4H4V3Zm0 7h7v11H4V10Zm10 0h6v5h-6v-5Zm0 8h6v3h-6v-3Z"/></svg>'
    };

    super(
      "组件开发模板",
      "amphiComponentTemplate",
      "演示 Amphi 内置 DataFrame 处理组件的表单、Python 代码生成与输出方式。",
      "pandas_df_processor",
      [],
      "开发模板",
      icon,
      defaultConfig,
      form
    );
  }

  provideImports() {
    return [
      "import numpy as np",
      "import pandas as pd"
    ];
  }

  /*
   * Amphi 会把这里返回的函数插入生成的 Python 脚本。
   *
   * 重要兼容规则：
   * - 不要在普通 Python 字符串中使用 .format()、"{}" 或 "{!r}"。
   * - Amphi 会把包含花括号的普通字符串强制改成 f-string。
   * - 错误信息请使用百分号格式，例如 "Missing: %s" % value。
   * - Python 字典本身使用花括号没有问题。
   */
  provideFunctions() {
    const embeddedPython = String.raw`
def run_amphi_component_template(
    dataframe,
    target_column=None,
    feature_columns=None,
    multiplier=1.0,
    output_column="template_score",
):
    if not isinstance(dataframe, pd.DataFrame):
        raise TypeError("Input must be a pandas DataFrame.")

    result = dataframe.copy()
    features = list(feature_columns or [])
    if not features:
        features = list(result.select_dtypes(include=[np.number]).columns)
    if target_column in features:
        features.remove(target_column)
    if not features:
        raise ValueError("Select at least one numeric feature column.")

    missing = [column for column in features if column not in result.columns]
    if missing:
        raise ValueError("Feature columns do not exist: %s" % missing)

    numeric = result[features].apply(pd.to_numeric, errors="coerce")
    numeric = numeric.fillna(numeric.median()).fillna(0.0)
    output_name = str(output_column or "template_score").strip()
    if not output_name:
        output_name = "template_score"

    result[output_name] = numeric.mean(axis=1) * float(multiplier)
    metrics = {
        "rows": int(len(result)),
        "features": features,
        "output_column": output_name,
    }
    print("Template component metrics:", metrics)
    return result, metrics
`;
    return [embeddedPython];
  }

  generateComponentCode({ config, inputName, outputName }) {
    const targetColumn = config?.tplTargetColumn?.value ?? "";
    const featureColumns = Array.isArray(config?.tplFeatureColumns)
      ? config.tplFeatureColumns.map((item) => item?.value).filter(Boolean)
      : [];
    const multiplier = Number(config?.tplMultiplier ?? 1);
    const outputColumn =
      String(config?.tplOutputColumn ?? "template_score").trim() ||
      "template_score";

    return `
${outputName}, ${outputName}_metrics = run_amphi_component_template(
    dataframe=${inputName},
    target_column=${JSON.stringify(targetColumn)},
    feature_columns=${JSON.stringify(featureColumns)},
    multiplier=${Number.isFinite(multiplier) ? multiplier : 1},
    output_column=${JSON.stringify(outputColumn)}
)
`.trim();
  }
}

export default new AmphiComponentTemplate();
