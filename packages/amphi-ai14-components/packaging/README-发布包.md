# AI14 模型评估与管理组件发布包

该发布包包含需求 14 对应的 9 个 Amphi 零代码组件，统一位于
“模型评估与管理组件”类别。

扩展标识：

```text
@local-ai/amphi-ai14-components
```

## 安装

```bash
tar -xzf amphi-ai14-components-1.0.0.tar.gz
cd amphi-ai14-components-1.0.0
./install.sh /absolute/path/to/python-venv
```

没有虚拟环境时：

```bash
./install.sh --user --python /absolute/path/to/python3
```

仅检查环境：

```bash
./install.sh --check --user --python /absolute/path/to/python3
```

安装成功应显示：

```text
@local-ai/amphi-ai14-components v1.0.0 enabled OK
```

Joblib 与 Pickle 文件能够执行反序列化逻辑，只读取可信来源的模型文件。
