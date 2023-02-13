export type RootStoreTypes = Record<string, symbol>

interface IModel<Properties extends { id: string } = { id: string }> {
  new (initProps: Partial<Properties>): {
    properties: Properties;
  };
}

type GQLData = {
  __typename: string;
  id: string;
} & {
  [key: string]: GQLData | GQLData[] | unknown;
}

type RootStoreModels = Record<string, IModel>

export class RootStore<Models extends RootStoreModels> {
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

  getModel<Name extends keyof Models>(modelName: Name): Models[Name] {
    const model = this.models[modelName];
    if (!model) throw new Error('Model not found'); // TODO: Better errors

    return model;
  }

  resolve<Data extends GQLData, ModelName extends Data['__typename']>(data: Data): InstanceType<Models[ModelName]> {
    if (!('__typename' in data) || !data.__typename) {
      throw new Error('Missing __typename selection in data'); // TODO: Better errors
    }

    if (!('id' in data) || !data.id) {
      throw new Error('Missing id selection in data'); // TODO: Better errors
    }

    const resolvedData = Object.entries(data).reduce((resolved, [key, value]) => {
      if (value && typeof value === 'object') {
        // TODO: Arrays could contain objects and other types
        if (Array.isArray(value) && typeof value[0] === 'object') {
          // TODO: Types
          (resolved as any)[key] = value.map((item) => this.resolve(item));
        } else {
          if (!('__typename' in value) || !value.__typename || typeof value.__typename !== 'string') {
            // Could be some custom hash scalar?
            return resolved;
          }

          if (!('id' in value) || !value.id || typeof value.id !== 'string') {
            throw new Error('Missing id selection in data');
          }

          // TODO: Types
          // Not sure why TS is so mad, we checked for __typename and id above
          (resolved as any)[key] = this.resolve(value as GQLData);
        }
      } else {
        // IModel has Record<string, unknown> in its properties, so this should be fine
        (resolved as Record<string, unknown>)[key] = value;
      }

      return resolved;
    }, {} as Partial<InstanceType<typeof Model>['properties']>);

    const Model = this.getModel(data.__typename);
    const store = this.getStore(Model);
    const instance = store[data.id];

    if (instance) {
      return this.update(Model, data.id, resolvedData);
    }

    return this.create(Model, resolvedData);
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

