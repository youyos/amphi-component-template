import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { ComponentManager } from '@amphi/pipeline-components-manager';

type ComponentService = {
  getComponent: (id: string) => unknown;
  addComponent: (component: unknown) => void;
};

// 每新增一个组件，只需要在这里增加一项。
// id 必须与组件构造函数传给 super() 的第二个参数完全一致。
const componentDefinitions = [
  {
    id: 'amphiComponentTemplate',
    load: () => import('./AmphiComponentTemplate')
  }
];

const plugin: JupyterFrontEndPlugin<void> = {
  id: '@local/amphi-custom-components:plugin',
  description: 'Registers custom built-in components in Amphi.',
  autoStart: true,
  requires: [ComponentManager],
  activate: (
    _app: JupyterFrontEnd,
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
          const componentModule = await definition.load();
          componentService.addComponent(componentModule.default);
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
