import {UserModel} from "../models/UserModel";

type KeyOf<T extends object> = Extract<keyof T, string>;

interface IModel {
  new (initProps: any): {
    properties: any;
  };
}

export type GQLData<Typename extends string> = Record<string, Resolvable<Typename> | Resolvable<Typename>[]> & Record<string, unknown>;

type Resolvable<Typename extends string> = {
  __typename: Typename;
  id: string;
}

type DeepResolved<Models extends RootStoreModels, ModelName extends KeyOf<Models>, Data extends object> = {
  [key in keyof Data]:
    Data[key] extends Resolvable<ModelName>
      ? InstanceType<Models[Data[key]['__typename']]>
      : Data[key] extends GQLData<ModelName>
        ? DeepResolved<Models, ModelName, Data[key]>
        : Data[key]
}

export type RootStoreModels = Record<string, IModel>;

export class RootStore<Models extends RootStoreModels, ModelName extends KeyOf<Models>> {
  instances: Record<string, Record<string, InstanceType<IModel>>> = {};
  models: Models;

  constructor(models: Models) {
    this.models = models;
  }
  
  getStore<T extends Models[string]>(Model: T) {
    const store = this.instances[Model.name];
    if (!store) {
      this.instances[Model.name] = {};
    }

    return this.instances[Model.name] as Record<string, InstanceType<T>>;
  }

  getModel<Name extends KeyOf<Models>>(modelName: Name): Models[Name] {
    const model = this.models[modelName];
    if (!model) throw new Error('Model not found'); // TODO: Better errors

    return model;
  }

  resolvable(data: object): data is Resolvable<ModelName> {
    if (!('id' in data) || !('__typename' in data)) return false;
    if (typeof data.__typename !== 'string' || !(data.__typename in this.models)) return false;
    return typeof data.id === 'string';
  }

  resolve<D extends object>(data: D): D extends Resolvable<ModelName> ? InstanceType<Models[typeof data['__typename']]> : DeepResolved<Models, ModelName, D> {
    const resolvedData = Object.entries(data).reduce((resolved, [key, value]) => {
      if (value && typeof value === 'object') {
        if (Array.isArray(value) && typeof value[0] === 'object') {
          resolved[key] = value.map((item) => {
            if (this.resolvable(item)) {
              return this.resolve(item);
            } else {
              return item;
            }
          });
        } else {
          resolved[key] = this.resolve(value);
        }
      } else {
        resolved[key] = value;
      }

      return resolved;
    }, {} as any); // TODO: Types

    if (this.resolvable(data)) {
      const Model = this.getModel(data.__typename);
      const store = this.getStore(Model);
      const instance = store[resolvedData.id];

      if (instance) {
        // TODO: Types
        return this.update(Model, resolvedData.id, resolvedData) as any;
      }

      // TODO: Types
      return this.create(Model, resolvedData) as any;
    }

    return resolvedData;
  }

  get<T extends Models[string]>(Model: T, id: string): InstanceType<T> | null {
    return this.getStore(Model)[id] || null;
  }

  update<T extends Models[string]>(Model: T, id: string, data: Partial<InstanceType<T>['properties']>) {
    const instance = this.get(Model, id);
    if (!instance) throw new Error('Instance not found'); // TODO: Better errors

    Object.assign(instance.properties, data);

    return instance;
  }

  create<T extends Models[string]>(Model: T, properties: Partial<InstanceType<T>['properties']>): InstanceType<T> {
    const instance = new Model(properties) as InstanceType<T>;
    const store = this.getStore(Model);
    const id = instance.properties.id;

    if (store[instance.properties.id]) {
      throw new Error('Instance already exists'); // TODO: Better errors
    }

    if (!id) throw new Error('Model must have an id property'); // TODO: Better errors

    store[instance.properties.id] = instance;
    this.models[Model.name as keyof Models] = Model;

    return instance;
  }

  delete(id: string) {
    return delete this.instances[id];
  }
}

