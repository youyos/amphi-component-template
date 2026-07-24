# Amphi 内置组件开发速查

## 固定架构

```text
组件 TSX
  → index.ts 动态注册
  → TypeScript 编译到 lib/
  → JupyterLab Builder 生成 labextension/
  → 复制到 Python 环境 share/jupyter/labextensions/
  → JupyterLab 启动时自动加入 Amphi ComponentManager
```

自定义扩展使用 `@local/*`，不要修改或覆盖 `@amphi/*` 官方目录。

## 每个新组件只改四处

1. 复制 `src/AmphiComponentTemplate.tsx`。
2. 修改 `super()` 中的显示名、唯一 id、组件类型和分类。
3. 修改表单、嵌入式 Python 和代码生成参数。
4. 在 `src/index.ts` 的 `componentDefinitions` 中注册动态导入。

## 三个 id 必须一致

```text
super() 的组件 id
index.ts 的 definition.id
运行时 componentService.getComponent(id)
```

扩展包名还需要与安装目录一致：

```text
package.json:
@local/amphi-custom-components

安装目录:
share/jupyter/labextensions/@local/amphi-custom-components/
```

## Python 代码最重要的兼容规则

Amphi 0.9.7 会二次格式化生成的 Python。普通字符串中的花括号会被强制改成
f-string。

不要使用：

```python
"Missing: {}".format(value)
"Invalid: {!r}".format(value)
```

统一使用：

```python
"Missing: %s" % value
"Invalid: %r" % value
```

Python 字典的花括号不受影响。

构建前必须执行：

```bash
python scripts/validate_embedded_python.py
```

## 构建安装

```bash
./scripts/build-and-install.sh /absolute/path/to/.venv-amphi
```

成功标志：

```text
@local/amphi-custom-components v0.1.0 enabled OK
```

然后完全重启 JupyterLab，并在浏览器硬刷新。

## 发布前验证

```text
嵌入式 Python 校验
→ TypeScript 编译
→ labextension 构建
→ jupyter labextension list
→ CSV 输入真实运行
→ 检查结果 DataFrame、模型变量和指标变量
→ 重启后确认仍自动注册
```

完整说明、源码和脚本位于 `amphi-component-template/`。
