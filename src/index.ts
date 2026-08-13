import {
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { ComponentManager } from '@amphi/pipeline-components-manager';

type ComponentService = {
  getComponent: (id: string) => unknown;
  addComponent: (component: unknown) => void;
};

import { algorithmCatalog } from './algorithmCatalog';

// 每个组件都有独立定义和全局唯一 id；共享模块只负责避免复制大型 Python 运行时。
const componentDefinitions = [
  ...algorithmCatalog.map(definition => ({
    id: definition.id,
    load: async () => {
      const module = await import('./AlgorithmComponents');
      return module.algorithmComponents.get(definition.id);
    }
  })),
  {
    id: 'javaExecutor',
    load: async () => {
      const module = await import('./JavaExecutorComponent');
      return module.default;
    }
  }
];

const plugin: JupyterFrontEndPlugin<void> = {
  id: '@local-ai/amphi-custom-components:plugin',
  description: 'Registers custom built-in components in Amphi.',
  autoStart: true,
  requires: [ComponentManager],
  activate: (
    _app,
    componentService: ComponentService
  ): void => {
    const registerWhenCoreIsReady = async (attempt = 0): Promise<void> => {
      const amphiGlobal = (globalThis as any).Amphi;
      if (!amphiGlobal?.BaseCoreComponent) {
        if (attempt >= 100) {
          console.error(
            '[Amphi custom] BaseCoreComponent was not available after 10 seconds.'
          );
          return;
        }
        setTimeout(() => {
          void registerWhenCoreIsReady(attempt + 1);
        }, 100);
        return;
      }

      try {
        for (const definition of componentDefinitions) {
          const component = await definition.load();
          if (!component) {
            throw new Error(`Component ${definition.id} could not be loaded.`);
          }
          componentService.addComponent(component);
          if (!componentService.getComponent(definition.id)) {
            throw new Error(
              `Component ${definition.id} was not found after registration.`
            );
          }
        }
        console.info(
          `[Amphi custom] ${componentDefinitions.length} component(s) registered.`
        );
      } catch (error) {
        console.error('[Amphi custom] Component registration failed.', error);
      }
    };

    void registerWhenCoreIsReady();
  }
};

export default plugin;
