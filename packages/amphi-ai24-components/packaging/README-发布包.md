# AI24 分析计算组件发布包

该包提供 19 个零代码分析计算组件，统一显示在“分析计算组件”侧栏类别。

扩展标识：

```text
@local-ai/amphi-ai24-components
```

安装：

```bash
tar -xzf amphi-ai24-components-1.0.0.tar.gz
cd amphi-ai24-components-1.0.0
./install.sh /absolute/path/to/python-venv
```

无虚拟环境时：

```bash
./install.sh --user --python /absolute/path/to/python3
```

成功标志：

```text
@local-ai/amphi-ai24-components v1.0.0 enabled OK
```

条件格式组件生成自包含 HTML，不需要访问外部 CDN。
