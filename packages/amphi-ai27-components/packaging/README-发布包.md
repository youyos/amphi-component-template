# AI27 平台扩展组件发布包

该发布包只包含需求 27 对应的 7 个 Amphi 组件，以及配套的“文档报告”
JupyterLab 右侧栏，不包含原来的 75 个算法组件或 Java 组件。

安装后的扩展标识：

```text
@local-ai/amphi-ai27-components
```

7 个组件统一位于“平台扩展组件”类别：

- R 语言执行
- Python 语言执行
- JavaScript 脚本执行
- 图形报表生成
- 文档模板输入
- 文档报告生成
- 文档报告导出

## 虚拟环境安装

```bash
tar -xzf amphi-ai27-components-1.1.0.tar.gz
cd amphi-ai27-components-1.1.0
./install.sh /absolute/path/to/python-venv
```

## 无虚拟环境安装

```bash
./install.sh --user --python /absolute/path/to/python3
```

## 仅检查环境

```bash
./install.sh --check --user --python /absolute/path/to/python3
```

支持范围：

- Python >= 3.11
- JupyterLab >= 4.3.4, < 5
- jupyterlab-amphi >= 0.9.0, < 1

R 组件需要目标机器安装 `Rscript`，JavaScript 组件需要 `node`。生成 DOCX
报告时还需要安装 `python-docx`。

安装成功后执行：

```bash
python -m jupyter labextension list
```

应显示：

```text
@local-ai/amphi-ai27-components v1.1.0 enabled OK
```
