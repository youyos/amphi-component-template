import { JupyterFrontEnd } from '@jupyterlab/application';
import { Widget } from '@lumino/widgets';

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) {
    node.className = className;
  }
  return node;
}

function normalizeContentsPath(value: string): string {
  return value.trim().replace(/^\/+/, '');
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(
      ...bytes.subarray(offset, offset + chunkSize)
    );
  }
  return btoa(binary);
}

function base64ToBlob(content: string, mimeType: string): Blob {
  const binary = atob(content);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: mimeType });
}

function mimeTypeFor(path: string): string {
  const extension = path.split('.').pop()?.toLowerCase();
  switch (extension) {
    case 'html':
    case 'htm':
      return 'text/html;charset=utf-8';
    case 'md':
    case 'markdown':
      return 'text/markdown;charset=utf-8';
    case 'docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    case 'svg':
      return 'image/svg+xml';
    default:
      return 'application/octet-stream';
  }
}

export class ReportDesignerPanel extends Widget {
  private readonly app: JupyterFrontEnd;
  private readonly status: HTMLDivElement;
  private readonly templatePath: HTMLInputElement;
  private readonly editor: HTMLTextAreaElement;
  private readonly placeholderType: HTMLSelectElement;
  private readonly placeholderName: HTMLInputElement;
  private readonly reportPath: HTMLInputElement;

  constructor(app: JupyterFrontEnd) {
    super({ node: element('div', 'amphi-report-designer') });
    this.app = app;
    this.id = 'amphi-document-report-designer';
    this.title.label = '文档报告';
    this.title.caption = '文档模板上传、占位符设计与报告下载';
    this.title.closable = true;

    const heading = element('h2');
    heading.textContent = '文档报告设计器';
    this.node.appendChild(heading);

    const help = element('p', 'amphi-report-help');
    help.textContent =
      '编辑 Markdown/HTML 模板，插入数据指标、计算规则、表格或图形占位符。DOCX 模板可直接上传。';
    this.node.appendChild(help);

    this.templatePath = this.textInput(
      '模板保存路径',
      'report-template.md'
    );

    const fileLabel = element('label');
    fileLabel.textContent = '上传模板';
    const fileInput = element('input');
    fileInput.type = 'file';
    fileInput.accept = '.md,.markdown,.html,.htm,.docx';
    fileLabel.appendChild(fileInput);
    this.node.appendChild(fileLabel);

    const uploadButton = this.button('上传到 Jupyter');
    uploadButton.addEventListener('click', () => {
      const file = fileInput.files?.[0];
      if (!file) {
        this.setStatus('请先选择模板文件。', true);
        return;
      }
      void this.uploadTemplate(file);
    });
    this.node.appendChild(uploadButton);

    const editorLabel = element('label');
    editorLabel.textContent = 'Markdown / HTML 模板内容';
    this.editor = element('textarea');
    this.editor.rows = 14;
    this.editor.value = `# 学生成绩报告

总记录数：{{ metric:rows }}

平均成绩：{{ calc:mean:score }}

{{ table:数据表 }}

{{ chart:default }}`;
    editorLabel.appendChild(this.editor);
    this.node.appendChild(editorLabel);

    const placeholderRow = element('div', 'amphi-report-row');
    this.placeholderType = element('select');
    for (const [value, label] of [
      ['metric', '数据指标'],
      ['calc', '函数计算'],
      ['table', '数据表格'],
      ['chart', '图形报表']
    ]) {
      const option = element('option');
      option.value = value;
      option.textContent = label;
      this.placeholderType.appendChild(option);
    }
    this.placeholderName = element('input');
    this.placeholderName.placeholder = 'rows、mean:score、数据表或 default';
    const insertButton = this.button('插入占位符');
    insertButton.addEventListener('click', () => this.insertPlaceholder());
    placeholderRow.append(
      this.placeholderType,
      this.placeholderName,
      insertButton
    );
    this.node.appendChild(placeholderRow);

    const saveButton = this.button('保存文本模板');
    saveButton.addEventListener('click', () => {
      void this.saveTextTemplate();
    });
    this.node.appendChild(saveButton);

    this.reportPath = this.textInput(
      '已生成报告路径',
      'reports/student-report.html'
    );
    const downloadButton = this.button('下载报告');
    downloadButton.addEventListener('click', () => {
      void this.downloadReport();
    });
    this.node.appendChild(downloadButton);

    this.status = element('div', 'amphi-report-status');
    this.status.setAttribute('role', 'status');
    this.node.appendChild(this.status);
    this.applyStyles();
  }

  private textInput(labelText: string, defaultValue: string): HTMLInputElement {
    const label = element('label');
    label.textContent = labelText;
    const input = element('input');
    input.type = 'text';
    input.value = defaultValue;
    label.appendChild(input);
    this.node.appendChild(label);
    return input;
  }

  private button(label: string): HTMLButtonElement {
    const button = element('button');
    button.type = 'button';
    button.textContent = label;
    return button;
  }

  private setStatus(message: string, isError = false): void {
    this.status.textContent = message;
    this.status.dataset.kind = isError ? 'error' : 'success';
  }

  private insertPlaceholder(): void {
    const name = this.placeholderName.value.trim();
    if (!name) {
      this.setStatus('请输入占位符名称或计算规则。', true);
      return;
    }
    const token = `{{ ${this.placeholderType.value}:${name} }}`;
    const start = this.editor.selectionStart;
    const end = this.editor.selectionEnd;
    this.editor.setRangeText(token, start, end, 'end');
    this.editor.focus();
    this.setStatus(`已插入 ${token}`);
  }

  private async uploadTemplate(file: File): Promise<void> {
    const path =
      normalizeContentsPath(this.templatePath.value) || file.name;
    try {
      const content = arrayBufferToBase64(await file.arrayBuffer());
      await this.app.serviceManager.contents.save(path, {
        type: 'file',
        format: 'base64',
        content
      });
      this.templatePath.value = path;
      this.setStatus(`模板已上传：${path}`);
    } catch (error) {
      this.setStatus(`模板上传失败：${String(error)}`, true);
    }
  }

  private async saveTextTemplate(): Promise<void> {
    const path = normalizeContentsPath(this.templatePath.value);
    if (!path) {
      this.setStatus('请填写模板保存路径。', true);
      return;
    }
    try {
      await this.app.serviceManager.contents.save(path, {
        type: 'file',
        format: 'text',
        content: this.editor.value
      });
      this.setStatus(`文本模板已保存：${path}`);
    } catch (error) {
      this.setStatus(`模板保存失败：${String(error)}`, true);
    }
  }

  private async downloadReport(): Promise<void> {
    const path = normalizeContentsPath(this.reportPath.value);
    if (!path) {
      this.setStatus('请填写报告路径。', true);
      return;
    }
    try {
      const model = await this.app.serviceManager.contents.get(path, {
        content: true
      });
      const blob =
        model.format === 'base64'
          ? base64ToBlob(String(model.content), mimeTypeFor(path))
          : new Blob([String(model.content)], { type: mimeTypeFor(path) });
      const url = URL.createObjectURL(blob);
      const anchor = element('a');
      anchor.href = url;
      anchor.download = path.split('/').pop() || 'report';
      anchor.click();
      URL.revokeObjectURL(url);
      this.setStatus(`报告已下载：${path}`);
    } catch (error) {
      this.setStatus(`报告下载失败：${String(error)}`, true);
    }
  }

  private applyStyles(): void {
    const style = element('style');
    style.textContent = `
.amphi-report-designer {
  box-sizing: border-box;
  height: 100%;
  overflow: auto;
  padding: 14px;
  color: var(--jp-ui-font-color1);
  background: var(--jp-layout-color1);
}
.amphi-report-designer h2 { margin: 0 0 8px; font-size: 17px; }
.amphi-report-help { color: var(--jp-ui-font-color2); line-height: 1.5; }
.amphi-report-designer label { display: block; margin: 12px 0 6px; font-weight: 600; }
.amphi-report-designer input,
.amphi-report-designer select,
.amphi-report-designer textarea {
  box-sizing: border-box;
  width: 100%;
  margin-top: 5px;
  padding: 7px 8px;
  color: var(--jp-ui-font-color1);
  background: var(--jp-input-background);
  border: 1px solid var(--jp-border-color2);
  border-radius: 3px;
}
.amphi-report-designer textarea { resize: vertical; font-family: var(--jp-code-font-family); }
.amphi-report-designer button {
  margin: 6px 6px 0 0;
  padding: 7px 10px;
  color: var(--jp-ui-inverse-font-color1);
  background: var(--jp-brand-color1);
  border: 0;
  border-radius: 3px;
  cursor: pointer;
}
.amphi-report-row { display: grid; grid-template-columns: 120px 1fr auto; gap: 6px; align-items: end; }
.amphi-report-status { margin-top: 12px; min-height: 22px; line-height: 1.4; }
.amphi-report-status[data-kind="error"] { color: var(--jp-error-color1); }
.amphi-report-status[data-kind="success"] { color: var(--jp-success-color1); }
`;
    this.node.appendChild(style);
  }
}

export function createReportDesignerPanel(
  app: JupyterFrontEnd
): ReportDesignerPanel {
  return new ReportDesignerPanel(app);
}
