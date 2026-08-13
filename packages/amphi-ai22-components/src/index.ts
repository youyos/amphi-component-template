import { JupyterFrontEndPlugin } from '@jupyterlab/application';
import { ComponentManager } from '@amphi/pipeline-components-manager';
import { chartCatalog } from './chartCatalog';

type ComponentService = {
  getComponent: (id: string) => unknown;
  addComponent: (component: unknown) => void;
};

const plugin: JupyterFrontEndPlugin<void> = {
  id: '@local-ai/amphi-ai22-components:plugin',
  description: 'Registers 50 zero-code visualization components in Amphi.',
  autoStart: true,
  requires: [ComponentManager],
  activate: (_app, componentService: ComponentService): void => {
    const registerWhenCoreIsReady = async (attempt = 0): Promise<void> => {
      const amphiGlobal = (globalThis as any).Amphi;
      if (!amphiGlobal?.BaseCoreComponent) {
        if (attempt >= 100) {
          console.error(
            '[Amphi AI22] BaseCoreComponent was not available after 10 seconds.'
          );
          return;
        }
        setTimeout(() => {
          void registerWhenCoreIsReady(attempt + 1);
        }, 100);
        return;
      }
      try {
        const module = await import('./ChartComponents');
        for (const definition of chartCatalog) {
          const component = module.chartComponents.get(definition.id);
          if (!component) {
            throw new Error(
              `Component ${definition.id} could not be loaded.`
            );
          }
          componentService.addComponent(component);
          if (!componentService.getComponent(definition.id)) {
            throw new Error(
              `Component ${definition.id} was not found after registration.`
            );
          }
        }
        console.info(
          `[Amphi AI22] ${chartCatalog.length} component(s) registered.`
        );
      } catch (error) {
        console.error('[Amphi AI22] Component registration failed.', error);
      }
    };
    void registerWhenCoreIsReady();
  }
};

export default plugin;
