import {ModelGenerator} from "./ModelGenerator";
import {indentString} from "../lib/indentString";
import dedent from "dedent";

export class RootStoreGenerator {
  models: ModelGenerator[] = [];

  constructor(models: ModelGenerator[]) {
    this.models = models;
  }

  fileName = "rootStore.tsx";

  get modelImports() {
    return this.models.map(model => {
      return `import { ${model.userEditableModelClassName} } from '../${model.userEditableModelClassName}';`;
    }).join('\n');
  }

  get rootStoreModels() {
    return this.models.map(model => {
      return `${model.modelType.name}: ${model.userEditableModelClassName},`;
    }).join('\n');
  }

  get code() {
    // I gave up trying to avoid keeping code inline with the template string. :(
    return `
import { createContext } from 'react';
import { RootStore } from 'mobx-depot';
${this.modelImports}

export const rootStore = new RootStore({
${indentString(this.rootStoreModels, 2)}
});

type RootStoreProviderProps = { children: React.ReactNode };

export const RootStoreContext = createContext({ rootStore });
export const RootStoreProvider = ({ children }: RootStoreProviderProps) => (
  <RootStoreContext.Provider value={{ rootStore }}>{children}</RootStoreContext.Provider>
);
    `;
  }
}