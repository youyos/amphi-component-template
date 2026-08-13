# Amphi 零代码算法、多语言、图形与文档报告扩展

适用环境：

- Python >= 3.11
- JupyterLab >= 4.3.4, < 5
- jupyterlab-amphi >= 0.9.0, < 1
- TypeScript 5.8

该模板使用“伴生预构建 JupyterLab 扩展”自动调用 Amphi
`ComponentManager.addComponent()`。不会修改 Amphi 官方包，升级、备份和卸载都更安全。

快速流程可以查看 [`docs/Amphi组件开发速查.md`](docs/Amphi组件开发速查.md)。
当前 5 个侧边栏分组、75 个算法的完整目录和配置方式见
[`docs/75种零代码算法组件.md`](docs/75种零代码算法组件.md)。
扩展还提供一个“编程语言组件”分组下的 Java 编程执行节点，支持 `.java`
源文件和内联代码。
R、Python、JavaScript、图形及文档报告组件与报告设计面板已经拆分到独立的
`@local-ai/amphi-ai27-components` 扩展，完整说明见
[`docs/多语言与文档报告组件.md`](docs/多语言与文档报告组件.md)。
模型评估、最优模型选择、模型输出、读取和利用已拆分到
`@local-ai/amphi-ai14-components` 扩展，使用说明见
[`docs/模型评估与管理组件.md`](docs/模型评估与管理组件.md)。
50 种零代码图表组件统一位于“图表组件”侧栏类别，并由独立的
`@local-ai/amphi-ai22-components` 扩展，完整目录见
[`docs/50种零代码图表组件.md`](docs/50种零代码图表组件.md)。
19 个零代码分析计算组件统一位于“分析计算组件”侧栏类别，并由
`@local-ai/amphi-ai24-components` 扩展，完整说明见
[`docs/分析计算组件.md`](docs/分析计算组件.md)。
使用 Codex 或其他开发代理维护该仓库时，请先阅读 [`AGENTS.md`](AGENTS.md)。

## 一、开发一个新组件

复制模板文件：

```bash
cp src/AmphiComponentTemplate.tsx src/MyAlgorithm.tsx
```

依次修改：

1. 类名。
2. `super()` 中的显示名、唯一 id、说明、组件类型、分类和图标。
3. `defaultConfig`。
4. `form.fields`。
5. `provideImports()`。
6. `provideFunctions()` 中的 Python 算法。
7. `generateComponentCode()` 中的参数读取和函数调用。

然后在 `src/index.ts` 注册：

```ts
const componentDefinitions = [
  {
    id: "myAlgorithm",
    load: () => import("./MyAlgorithm")
  }
];
```

组件 id 必须满足：

- `super()` 的第二个参数是 `myAlgorithm`。
- `componentDefinitions` 的 `id` 也是 `myAlgorithm`。
- 同一个 Amphi 环境中不能和其他组件重复。

## 二、常用组件类型

| 场景 | 组件类型 |
|---|---|
| CSV、数据库等数据源 | `pandas_df_input` |
| 分类、回归、聚类、转换 | `pandas_df_processor` |
| 两个 DataFrame 输入，例如 Join | `pandas_df_double_processor` |
| 多个 DataFrame 输入 | `pandas_df_multi_processor` |
| CSV、Excel、Python 输出 | `pandas_df_output` |

类型会决定 Amphi 节点输入/输出端口以及传给 `generateComponentCode()` 的参数。

## 三、表单字段

已验证的常用字段：

```ts
{ type: "info", id: "info", text: "说明" }
{ type: "column", id: "target", label: "目标列", required: true }
{ type: "columns", id: "features", label: "特征列" }
{ type: "input", id: "name", label: "名称" }
{ type: "inputNumber", id: "depth", label: "最大深度", min: 1 }
{ type: "boolean", id: "pruning", label: "启用剪枝" }
```

字段 id、`defaultConfig` 键和 `generateComponentCode()` 读取的键必须完全一致。

`column` 返回：

```ts
config.target?.value
```

`columns` 返回数组：

```ts
const columns = Array.isArray(config.features)
  ? config.features.map(item => item?.value).filter(Boolean)
  : [];
```

## 四、嵌入式 Python 规则

Amphi 0.9.7 会对所有生成代码执行 `formatVariables()`，包含花括号的普通字符串
会被强制改成 f-string。

禁止：

```python
"Missing columns: {}".format(missing)
"Feature {!r} is invalid".format(name)
```

推荐：

```python
"Missing columns: %s" % missing
"Feature %r is invalid" % name
```

Python 字典本身可以正常使用花括号：

```python
metrics = {
    "accuracy": accuracy,
    "rows": len(result),
}
```

每次构建前必须运行：

```bash
python scripts/validate_embedded_python.py
```

它会先模拟 Amphi 的二次格式化，再调用 Python AST 解析器检查语法。

## 五、构建和安装

首次构建需要安装 JavaScript 依赖。将虚拟环境绝对路径传给脚本：

```bash
chmod +x scripts/build-and-install.sh
./scripts/build-and-install.sh /absolute/path/to/.venv-amphi
```

脚本依次执行：

1. 检查嵌入式 Python。
2. 安装 JavaScript 依赖。
3. 编译 TypeScript。
4. 使用 development 模式构建预构建扩展。
5. 备份旧版本。
6. 将 `labextension/` 安装到当前 Python 环境。
7. 执行 `jupyter labextension list`。

成功标志（当前版本为 2.0.1）：

```text
@local-ai/amphi-custom-components v2.0.1 enabled OK
```

安装器检测到旧的 `@local/amphi-custom-components` 时，会先将它移动到
`labextension-backups/@local/`，再安装新的 `@local-ai` 扩展。

安装后需要完全重启 JupyterLab，并在浏览器执行硬刷新。

## 六、发布和迁移

生成带安装脚本、依赖清单、说明文档和 SHA-256 校验文件的离线发布包：

```bash
./scripts/package-release.sh
```

产物位于：

```text
dist/amphi-custom-components-2.0.1.tar.gz
dist/amphi-custom-components-2.0.1.tar.gz.sha256
```

目标机器解压后执行：

```bash
./install.sh /absolute/path/to/python-venv
```

发布包为预构建扩展，目标机器安装扩展本身不需要 Node.js 构建工具。运行
JavaScript 脚本组件时需要 Node.js，运行 R 组件时需要 Rscript；Python 运行依赖
根据包内 `python-requirements.txt` 单独安装。

## 七、发布前检查清单

- 组件 id 唯一，注册 id 与 `super()` 一致。
- 分类名称正确。
- 表单字段、默认值、代码生成键一致。
- 输入列不存在时给出清晰错误。
- 目标列为空、类别不足、小样本等边界情况有检查。
- 输出 DataFrame 不意外修改输入对象。
- 输出列名不会静默覆盖重要原始字段。
- 训练/测试划分支持固定随机种子。
- 模型、指标和结果 DataFrame 都有明确输出变量。
- 不在普通 Python 字符串中使用 `{}` 或 `.format()`。
- 嵌入式 Python 校验通过。
- TypeScript 编译通过。
- 使用真实 CSV 在 Amphi 中运行通过。
- Java 执行组件使用真实 `javac` 和 `java` 完成编译、运行及结果 CSV 回读测试。
- Python/JavaScript 脚本、SVG 图形、模板绑定、报告生成和报告导出测试通过。
- `jupyter labextension list` 显示 `enabled OK`。
- 重启 JupyterLab并硬刷新后仍能自动注册。
