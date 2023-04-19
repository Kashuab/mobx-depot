import dedent from "dedent";

export function generateUseInstanceHooks() {
  return dedent`
    import { useState } from 'react';
    import { getRootStore, RootStoreModel } from './rootStore';
    
    export function useNewInstance<ModelType extends RootStoreModel>(Model: ModelType, init: Partial<InstanceType<ModelType>>) {
      const rootStore = getRootStore();
      
      const [instance] = useState(() => rootStore.create(Model, init));
      
      return instance;
    }
    
    export function useInstance<ModelType extends RootStoreModel>(Model: ModelType, id: string) {      
      const rootStore = getRootStore();
      
      return rootStore.find(Model, id);
    }
  `
}