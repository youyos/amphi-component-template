import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { ComponentManager } from '@amphi/pipeline-components-manager';

type ComponentService = {
  getComponent: (id: string) => unknown;
  addComponent: (component: unknown) => void;
};

const componentIds = [
  'rLanguageExecutor',
  'pythonLanguageExecutor',
  'javascriptExecutor',
  'chartReportGenerator',
  'reportTemplateInput',
  'documentReportGenerator',
  'documentReportExport'
];

async function addReportDesignerPanel(app: JupyterFrontEnd): Promise<void> {
  try {
    const module = await import('./ReportDesignerPanel');
    const panel = module.createReportDesignerPanel(app);
    app.shell.add(panel, 'right', { rank: 1000 });
  } catch (error) {
    console.error('[Amphi AI27] Report designer panel failed.', error);
  }
}

const plugin: JupyterFrontEndPlugin<void> = {
  id: '@local-ai/amphi-ai27-components:plugin',
  description:
    'Registers seven language, chart, and document report components in Amphi.',
  autoStart: true,
  requires: [ComponentManager],
  activate: (
    app: JupyterFrontEnd,
    componentService: ComponentService
  ): void => {
    const registerWhenCoreIsReady = async (attempt = 0): Promise<void> => {
      const amphiGlobal = (globalThis as any).Amphi;
      if (!amphiGlobal?.BaseCoreComponent) {
        if (attempt >= 100) {
          console.error(
            '[Amphi AI27] BaseCoreComponent was not available after 10 seconds.'
          );
          return;
        }
        setTimeout(() => {
          void registerWhenCoreIsReady(attempt + 1);
        }, 100);
        return;
      }

      try {
        const module = await import('./ScriptReportComponents');
        for (const id of componentIds) {
          const component = module.scriptReportComponents.get(id);
          if (!component) {
            throw new Error(`Component ${id} could not be loaded.`);
          }
          componentService.addComponent(component);
          if (!componentService.getComponent(id)) {
            throw new Error(
              `Component ${id} was not found after registration.`
            );
          }
        }
        console.info(
          `[Amphi AI27] ${componentIds.length} component(s) registered.`
        );
      } catch (error) {
        console.error('[Amphi AI27] Component registration failed.', error);
      }
      await addReportDesignerPanel(app);
    };

    void registerWhenCoreIsReady();
  }
};

export default plugin;
