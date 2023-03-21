type KeyOf<T extends object> = Extract<keyof T, string>;

type IdentifiableModelInstance<IDFieldName extends string> = {
  [key in IDFieldName]?: string;
} 

type ModelInstanceUtilities = ({
  assign: (data: any) => void;
} | {
  _assign: (data: any) => void;
}) & {
  __setSource: (source: ResolveSource) => void;
}

type ModelInstance<IDFieldName extends string> = (IdentifiableModelInstance<IDFieldName> | {}) & ModelInstanceUtilities;

type Model<IDFieldName extends string> = {
  new (...args: any): ModelInstance<IDFieldName>
}

type Resolvable<Typename extends string, IDFieldName extends string> = {
  __typename: Typename;
} & {
  [key in IDFieldName]: string;
}

type DeepResolved<IDFieldName extends string, Models extends RootStoreModels<IDFieldName>, ModelName extends KeyOf<Models>, Data extends object> =
  Data extends Resolvable<ModelName, IDFieldName>
    ? InstanceType<Models[Data['__typename']]>
    : {
        [key in keyof Data]:
          Data[key] extends Resolvable<ModelName, IDFieldName>
            ? InstanceType<Models[Data[key]['__typename']]>
            : Data[key] extends object
              ? DeepResolved<IDFieldName, Models, ModelName, Data[key]>
              : Data[key]
      }

export type RootStoreModels<IDFieldName extends string> = { readonly [key: string]: Model<IDFieldName> };

type RootStoreOpts<IDFieldName extends string> = {
  idFieldName: IDFieldName;
}

type ResolveSource = 'remote' | 'local';

export class RootStore<IDFieldName extends string, Models extends RootStoreModels<IDFieldName>, ModelName extends KeyOf<Models>> {
  private opts: RootStoreOpts<IDFieldName>;

  private instances: Record<string, Record<string, InstanceType<Models[ModelName]>>> = {};

  private _models: Models | null = null;
  private readonly generateModels: () => Models;
  private get models() {
    return this._models ||= this.generateModels();
  }

  /**
   * @param models A map of `{ "__typename": ModelClass }` for all resolvable types
   */
  constructor(models: () => Models, opts: RootStoreOpts<IDFieldName>) {
    this.generateModels = models;
    this.opts = opts;
  }

  get idFieldName() {
    return this.opts.idFieldName;
  }

  // TODO: __typename gets in the instances
  public resolve<D extends object>(
    data: D,
    source: ResolveSource = 'local',
  ): DeepResolved<IDFieldName, Models, ModelName, D> {
    const resolvedData = Object.entries(data).reduce((resolved, [key, value]) => {
      if (value && typeof value === 'object') {
        if (Array.isArray(value)) {
          resolved[key] = value.map((item) => {
            if (this.isResolvable(item)) {
              return this.resolve(item, source);
            } else {
              return item;
            }
          });
        } else {
          resolved[key] = this.resolve(value, source);
        }
      } else {
        resolved[key] = value;
      }

      return resolved;
    }, {} as any); // TODO: Types

    if (this.isResolvable(data)) {
      const Model = this.getModel(data.__typename);
      const store = this.getInstanceStore(Model);
      const id = this.getInstanceId(resolvedData);

      if (id) {
        const instance = store[id];

        if (instance) {
          // TODO: Types
          return this.update(Model, id, resolvedData, source) as any;
        }
      }

      // TODO: Types
      return this.create(Model, resolvedData, source) as any;
    }

    return resolvedData;
  }

  public get<T extends Models[ModelName]>(Model: T, id: string): InstanceType<T> | null {
    return this.getInstanceStore(Model)[id] || null;
  }

  public update<T extends Models[ModelName]>(
    Model: T,
    id: string,
    data: Partial<InstanceType<T>>,
    source: ResolveSource = 'local'
  ) {
    const instance = this.get(Model, id);
    if (!instance) throw new Error('Instance not found'); // TODO: Better errors

    // Handle potential conflicts with GraphQL fields
    if ('assign' in instance) {
      instance.assign(data);
    } else if ('_assign' in instance) {
      instance._assign(data);
    } else {
      throw new Error(`${Model.name} does not have an assign method`);
    }

    instance.__setSource(source);

    return instance;
  }

  public create<T extends Models[ModelName]>(
    Model: T,
    properties: Partial<InstanceType<T>>,
    source: ResolveSource = 'local'
  ): InstanceType<T> {
    const instance = new Model(properties) as InstanceType<T>;

    instance.__setSource(source);

    const store = this.getInstanceStore(Model);
    const id = this.getInstanceId(instance) || this.generateModelId(Model);

    if (store[id]) {
      throw new Error('Instance already exists'); // TODO: Better errors
    }

    if (!id) throw new Error('Model must have an id property'); // TODO: Better errors

    store[id] = instance;
    this.models[Model.name as keyof Models] = Model;

    return instance;
  }

  /**
   * Remove the `target` from the store, and replace all references to it with `source`.
   */
  public replace<T extends Models[ModelName]>(target: InstanceType<T>, source: InstanceType<T>) {
    const TargetModel = this.getModelClass(target);
    const targetId = this.getInstanceId(target);

    if (!targetId) {
      throw new Error(`Target is not eligible for replacement: ${TargetModel.name}`);
    }

    if (!this.modelRecognized(TargetModel)) {
      // TODO: Types, TargetModel becomes never here due to modelRecognized predicate
      throw new Error(`Model not recognized: ${(TargetModel as any).name}`);
    }

    const sourceId = this.getInstanceId(source);

    if (sourceId !== targetId) {
      throw new Error('When replacing an instance with another, they must have the same ID');
    }

    this.keep(source);
    this.deepReplace(target, source);
  }

  private instanceIsIdentifiable(
    instance: ModelInstance<IDFieldName>
  ): instance is (typeof instance & IdentifiableModelInstance<IDFieldName>) {
    return this.idFieldName in instance;
  }

  private getInstanceId(instance: ModelInstance<IDFieldName>): string | null {
    try {
      if (!this.instanceIsIdentifiable(instance)) return null;

      const id = instance[this.idFieldName];
      if (!id) return null;

      return id;
    } catch (err) {
      // TODO: Check for SelectionError, remove console.error
      console.error(err);
      return null;
    }
  }

  private getModelClass<T extends Models[ModelName]>(instance: InstanceType<T>): T {
    return Object.getPrototypeOf(instance).constructor;
  }

  /**
   * Find any reference to `target` and replace it with `source`.
   */
  private deepReplace<T extends Models[ModelName]>(target: InstanceType<T>, source: InstanceType<T>) {
    const allStores = Object.values(this.instances);
    const injected: any[] = [];

    const inject = (obj: any) => {
      // Prevent infinite recursion in case of circular references
      if (injected.includes(obj)) return;
      injected.push(obj);

      for (const key in obj) {
        if (!obj.hasOwnProperty(key)) continue;

        if (obj[key] === target) {
          obj[key] = source;
        } else if (obj[key] instanceof Array) {
          obj[key] = obj[key].map((value: any) => {
            if (value === target) return source;

            if (value instanceof Array) {
              value.forEach(inject);
            } else if (typeof value === 'object') {
              inject(value);
            }

            return value;
          });
        } else if (typeof obj[key] === 'object') {
          inject(obj[key]);
        }
      }
    }

    allStores.forEach((store) => {
      const storeInstances = Object.values(store);

      storeInstances.forEach(inject);
    });
  }

  private keep(instance: InstanceType<Models[ModelName]>) {
    const id = this.getInstanceId(instance);
    if (!id) {
      throw new Error(`Target is not eligible for injection: ${this.getModelClass(instance).name}`);
    }

    const Model = this.getModelClass(instance);
    const store = this.getInstanceStore(Model);

    if (!store) {
      throw new Error(`Model not recognized: ${Model.name}`);
    }

    store[id] = instance;
  }
  
  private getInstanceStore<T extends Models[ModelName]>(Model: T) {
    const store = this.instances[Model.name];
    if (!store) {
      this.instances[Model.name] = {};
    }

    return this.instances[Model.name] as Record<string, InstanceType<T>>;
  }

  private getModel<Name extends KeyOf<Models>>(modelName: Name): Models[Name] {
    const model = this.models[modelName];
    if (!model) throw new Error('Model not found'); // TODO: Better errors

    return model;
  }

  private isResolvable(data: unknown): data is Resolvable<ModelName, IDFieldName> {
    if (typeof data !== 'object' || data === null) return false;
    if (!('__typename' in data)) return false;
    return !(typeof data.__typename !== 'string' || !(data.__typename in this.models));
  }

  private modelRecognized(Model: any): Model is Models[ModelName] {
    return Object.values(this.models).some(StoredModel => StoredModel === Model);
  }

  private generateModelId<T extends Models[ModelName]>(Model: T) {
    const generate = () => `__$depot_auto_id:${Math.random().toString(36).substring(2)}`;
    let idAttempt = generate();

    while (this.get(Model, idAttempt)) {
      idAttempt = generate();
    }

    return idAttempt;
  }
}

