import {
  buildJavaExecutorCode,
  DEFAULT_JAVA_CODE
} from './javaExecutorCode';
import { javaRuntime } from './javaRuntime';

class JavaExecutorComponent extends (globalThis as any).Amphi.BaseCoreComponent {
  constructor() {
    const defaultConfig = {
      javaSourceMode: 'file',
      javaSourcePath: '',
      javaInlineCode: DEFAULT_JAVA_CODE,
      javaMainClass: '',
      javaArguments: '',
      javaClasspath: '',
      javaTimeoutSeconds: 30,
      javaResultMode: 'auto',
      javaArtifactDirectory: '',
      javacCommand: 'javac',
      javaCommand: 'java'
    };
    const form = {
      idPrefix: 'amphi_java_executor',
      fields: [
        {
          type: 'info',
          id: 'javaInfo',
          text: '在 Python 流程中安全调用 javac 和 java。组件自动将输入 DataFrame 写入 CSV，并把输入、输出 CSV 绝对路径作为 Java main 方法的 args[0]、args[1]。',
          advanced: false
        },
        {
          type: 'info',
          id: 'javaSecurityInfo',
          text: 'Java 程序与 JupyterLab 服务器拥有相同的文件和网络权限，只运行可信代码。',
          advanced: false
        },
        {
          type: 'radio',
          label: '代码来源',
          id: 'javaSourceMode',
          options: [
            { value: 'file', label: 'Java 源文件（推荐）' },
            { value: 'inline', label: '内联代码' }
          ],
          advanced: false
        },
        {
          type: 'file',
          label: 'Java 源文件路径',
          id: 'javaSourcePath',
          placeholder: '选择 UTF-8 编码的 .java 文件',
          tooltip: '支持 Jupyter 文件浏览器路径；以 / 开头但不属于系统根目录的路径会同时按 Jupyter 工作目录解析。',
          validation: '^.*\\.java$',
          condition: { javaSourceMode: 'file' },
          required: false,
          advanced: false
        },
        {
          type: 'codeTextarea',
          label: '内联 Java 代码',
          id: 'javaInlineCode',
          mode: 'java',
          height: '320px',
          placeholder: 'public class Main { ... }',
          condition: { javaSourceMode: 'inline' },
          required: false,
          advanced: false
        },
        {
          type: 'input',
          label: '主类全名（可选）',
          id: 'javaMainClass',
          placeholder: '自动识别，例如 com.example.Main',
          tooltip: '通常留空；包含 package 声明时组件会自动组合完整类名。',
          advanced: false
        },
        {
          type: 'input',
          label: '程序参数（可选）',
          id: 'javaArguments',
          placeholder: '--name \"测试用户\"',
          tooltip: '这些参数追加在 args[0] 输入 CSV 和 args[1] 输出 CSV 之后。',
          advanced: true
        },
        {
          type: 'input',
          label: '类路径 Classpath（可选）',
          id: 'javaClasspath',
          placeholder: '/path/to/dependency.jar',
          tooltip: '多个路径使用当前操作系统的 classpath 分隔符连接。',
          advanced: true
        },
        {
          type: 'inputNumber',
          label: '编译/运行超时（秒）',
          id: 'javaTimeoutSeconds',
          min: 1,
          max: 600,
          step: 1,
          advanced: true
        },
        {
          type: 'radio',
          label: '输出 DataFrame',
          id: 'javaResultMode',
          options: [
            {
              value: 'auto',
              label: '优先读取结果 CSV'
            },
            {
              value: 'input',
              label: '保留输入数据'
            },
            {
              value: 'logs',
              label: '输出控制台日志'
            }
          ],
          tooltip: '自动模式下，Java 写入 args[1] 指定文件时读取该 CSV；未写入则保留输入 DataFrame。',
          advanced: false
        },
        {
          type: 'input',
          label: '执行产物保存目录（可选）',
          id: 'javaArtifactDirectory',
          placeholder: '留空则使用并自动清理临时目录',
          tooltip: '填写后保存源码、输入/输出 CSV 和 execution.json 日志。',
          advanced: true
        },
        {
          type: 'input',
          label: 'javac 命令',
          id: 'javacCommand',
          placeholder: 'javac',
          advanced: true
        },
        {
          type: 'input',
          label: 'java 命令',
          id: 'javaCommand',
          placeholder: 'java',
          advanced: true
        }
      ]
    };
    const icon = {
      name: 'amphi-java-executor-icon',
      svgstr:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M6 3h9v2H8v7a4 4 0 0 0 4 4h1v2h-1a6 6 0 0 1-6-6V3Zm9 4h2.5A3.5 3.5 0 0 1 21 10.5v1a3.5 3.5 0 0 1-3.5 3.5H15v-2h2.5a1.5 1.5 0 0 0 1.5-1.5v-1A1.5 1.5 0 0 0 17.5 9H15V7ZM4 20h16v2H4v-2Z"/><text x="9.4" y="13.1" fill="currentColor" font-size="5.2" font-family="sans-serif" font-weight="700">JAVA</text></svg>'
    };

    super(
      'Java 编程执行',
      'javaExecutor',
      '编译并执行 Java 源文件或内联代码，支持 DataFrame CSV 输入输出、控制台日志、超时和外部 Classpath。',
      'pandas_df_processor',
      [],
      '编程语言组件',
      icon,
      defaultConfig,
      form
    );
  }

  provideImports() {
    return [];
  }

  provideFunctions() {
    return [javaRuntime];
  }

  generateComponentCode({ config, inputName, outputName }) {
    return buildJavaExecutorCode(config, inputName, outputName);
  }
}

export default new JavaExecutorComponent();
