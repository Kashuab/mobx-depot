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
import { GraphQLClient } from 'graphql-request';
${this.modelImports}

const rootStore = new RootStore({
${indentString(this.rootStoreModels, 2)}
});

let graphqlClient: GraphQLClient | null = null;

export function getGraphQLClient() {
  if (!graphqlClient) {
    throw new Error('GraphQL client not set, you must call setGraphQLClient in the root of your application.');
  }
  
  return graphqlClient;
}

export function getRootStore() {
  return rootStore;
}

export function setGraphQLClient(client: GraphQLClient) {
  graphqlClient = client;
}

type RootStoreProviderProps = { children: React.ReactNode };

export const RootStoreContext = createContext({ rootStore });
export const RootStoreProvider = ({ children }: RootStoreProviderProps) => (
  <RootStoreContext.Provider value={{ rootStore }}>{children}</RootStoreContext.Provider>
);
    `;
  }
}