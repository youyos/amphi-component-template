# Amphi 算法与 Java 组件扩展发布包

该发布包包含已经构建完成的 JupyterLab 预构建扩展。目标环境不需要安装
Node.js、jlpm 或 TypeScript。

## 兼容环境

- Python 3.11 或更高版本（已兼容 Python 3.13）
- JupyterLab >= 4.3.4, < 5
- jupyterlab-amphi >= 0.9.0, < 1
- pandas 2.x
- NumPy 1.26–2.x
- scikit-learn 1.5–1.x
- Java 执行组件可选依赖 JDK 8 或更高版本（需要 `javac` 和 `java`）

Python 数据科学依赖需要提供目标 Python 版本对应的可用 wheel。JupyterLab 5 和
Amphi 1.x 属于新的大版本，需另行验证。

## 安装

解压：

```bash
tar -xzf amphi-custom-components-2.0.1.tar.gz
cd amphi-custom-components-2.0.1
```

安装到指定 Python 虚拟环境：

```bash
chmod +x install.sh
./install.sh /absolute/path/to/python-venv
```

也可以先激活目标虚拟环境：

```bash
source /absolute/path/to/python-venv/bin/activate
./install.sh
```

没有虚拟环境时，安装到当前用户的 Jupyter 数据目录：

```bash
./install.sh --user
```

如果系统里有多个 Python，可明确指定启动 JupyterLab 的那个 Python：

```bash
./install.sh --user --python /absolute/path/to/python3
```

用户级安装不写 `/usr`、`/opt` 等系统目录，一般不需要 `sudo`。必须确保指定的
Python 正是平时用于启动 JupyterLab 的 Python。

安装前只检查环境、不写入文件：

```bash
./install.sh --check /absolute/path/to/python-venv
./install.sh --check --user --python /absolute/path/to/python3
```

安装脚本会：

1. 检查 Python、JupyterLab、Amphi、pandas、NumPy 和 scikit-learn。
2. 把已有版本备份到 `share/jupyter/labextension-backups/`。
3. 安装预构建扩展到 `share/jupyter/labextensions/@local-ai/`。
4. 如果检测到旧的 `@local/amphi-custom-components`，先将其移到
   `labextension-backups/@local/`，避免两个 scope 重复注册组件。
5. 运行 `jupyter labextension list`。

成功标志：

```text
@local-ai/amphi-custom-components v2.0.1 enabled OK
```

安装完成后必须完全重启 JupyterLab，并在浏览器硬刷新。

## Python 依赖

如果环境检查提示缺包，可在目标虚拟环境中执行：

```bash
/absolute/path/to/python-venv/bin/pip install -r python-requirements.txt
```

安装依赖需要访问 Python 软件源；发布包本身不包含第三方 Python wheel。

## 文件校验

发布包旁边提供 `.sha256` 文件。在 macOS/Linux 上可执行：

```bash
shasum -a 256 -c amphi-custom-components-2.0.1.tar.gz.sha256
```

## 包含内容

```text
amphi-custom-components-2.0.1/
  install.sh
  README.md
  python-requirements.txt
  COMPONENTS.md
  labextension/
    package.json
    static/
```
