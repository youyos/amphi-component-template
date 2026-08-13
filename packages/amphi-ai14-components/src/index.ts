import { JupyterFrontEndPlugin } from '@jupyterlab/application';
import { ComponentManager } from '@amphi/pipeline-components-manager';

type ComponentService = {
  getComponent: (id: string) => unknown;
  addComponent: (component: unknown) => void;
};

const componentIds = [
  'ksModelEvaluation',
  'prModelEvaluation',
  'rocModelEvaluation',
  'classificationModelEvaluation',
  'regressionModelEvaluation',
  'bestModelSelection',
  'modelArtifactExport',
  'modelArtifactInput',
  'modelPredictionUse'
];

const plugin: JupyterFrontEndPlugin<void> = {
  id: '@local-ai/amphi-ai14-components:plugin',
  description: 'Registers model evaluation and lifecycle components in Amphi.',
  autoStart: true,
  requires: [ComponentManager],
  activate: (_app, componentService: ComponentService): void => {
    const registerWhenCoreIsReady = async (attempt = 0): Promise<void> => {
      const amphiGlobal = (globalThis as any).Amphi;
      if (!amphiGlobal?.BaseCoreComponent) {
        if (attempt >= 100) {
          console.error(
            '[Amphi AI14] BaseCoreComponent was not available after 10 seconds.'
          );
          return;
        }
        setTimeout(() => {
          void registerWhenCoreIsReady(attempt + 1);
        }, 100);
        return;
      }

      try {
        const module = await import('./ModelEvaluationComponents');
        for (const id of componentIds) {
          const component = module.modelEvaluationComponents.get(id);
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
          `[Amphi AI14] ${componentIds.length} component(s) registered.`
        );
      } catch (error) {
        console.error('[Amphi AI14] Component registration failed.', error);
      }
    };

    void registerWhenCoreIsReady();
  }
};

export default plugin;
