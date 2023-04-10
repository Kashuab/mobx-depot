import {ModelGenerator} from "./ModelGenerator";
import {indentString} from "../lib/indentString";

type RootStoreGeneratorOpts = {
  idFieldName: string;
}

export class RootStoreGenerator {
  models: ModelGenerator[] = [];
  opts: RootStoreGeneratorOpts;

  constructor(models: ModelGenerator[], opts: RootStoreGeneratorOpts) {
    this.opts = opts;
    this.models = models;
  }

  get idFieldName() {
    return this.opts.idFieldName;
  }

  fileName = "rootStore.ts";

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
import { RootStore, DepotGQLClient } from 'mobx-depot';
${this.modelImports}

// Use a function so they can be injected lazily, avoids circular dependency issues at runtime
const getModels = () => ({
${indentString(this.rootStoreModels, 2)}
});

type ModelMap = ReturnType<typeof getModels>;
type GQLTypename = keyof ModelMap;

export type RootStoreModel = ModelMap[GQLTypename];

const rootStore = new RootStore(getModels, { idFieldName: "${this.idFieldName}" });

let client: DepotGQLClient<"${this.idFieldName}", ModelMap, GQLTypename> | null = null;

export function getGraphQLClient() {
  if (!client) {
    throw new Error('GraphQL client not set, you must call initializeDepotClient in the root of your application.');
  }
  
  return client;
}

export function getRootStore() {
  return rootStore;
}

export function initializeDepotClient(url: string, opts: ConstructorParameters<typeof DepotGQLClient>[1] = {}) {
  client = new DepotGQLClient(url, opts, rootStore);
  
  return client;
}
    `;
  }
}