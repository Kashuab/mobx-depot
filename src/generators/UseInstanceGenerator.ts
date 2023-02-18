import dedent from "dedent";

export function generateUseInstanceHooks() {
  return dedent`
    import { useContext, useState } from 'react';
    import { RootStoreContext, RootStoreModel } from './rootStore'
    
    export function useNewInstance<ModelType extends RootStoreModel>(Model: ModelType, init: Partial<InstanceType<ModelType>>) {
      const { rootStore } = useContext(RootStoreContext);
      
      const [instance] = useState(() => rootStore.create(Model, init));
      
      return instance;
    }
    
    export function useInstance<ModelType extends RootStoreModel>(Model: ModelType, id: string) {
      const { rootStore } = useContext(RootStoreContext);
      
      return rootStore.get(Model, id);
    }
  `
}