import {action, makeAutoObservable, makeObservable, observable} from "mobx";

export type KeyOf<T extends object> = Extract<keyof T, string>;

type Resolvable<Typename extends string> = IdentifiableObjectType & {
  __typename: Typename;
}

export type DeepResolved<
  ObjectTypes extends RootStoreObjectTypes,
  Typename extends KeyOf<ObjectTypes>,
  Data extends object
> =
  Data extends Resolvable<Typename>
    ? ObjectTypes[Data['__typename']]
    : {
        [key in keyof Data]:
          Data[key] extends Resolvable<Typename>
            ? ObjectTypes[Data[key]['__typename']]
            : Data[key] extends object
              ? DeepResolved<ObjectTypes, Typename, Data[key]>
              : Data[key]
      }

export type ObjectType = { [key in string]: any } & { __typename: string; }
export type IdentifiableObjectType = ObjectType & { id: string; }

export type RootStoreObjectTypes = { readonly [__typename: string]: ObjectType | IdentifiableObjectType };

type RootStoreCallbacks<
  ObjectTypes extends RootStoreObjectTypes,
  Typename extends KeyOf<ObjectTypes>
> = {
  afterCreate: RootStoreCallback<ObjectTypes, Typename>[];
  afterUpdate: RootStoreCallback<ObjectTypes, Typename>[];
}

type RootStoreCallback<
  ObjectTypes extends RootStoreObjectTypes,
  Typename extends KeyOf<ObjectTypes>
> = (object: ObjectTypes[Typename]) => void;

type RootStoreCallbackName = keyof RootStoreCallbacks<any, any>;

export class RootStore<ObjectTypes extends RootStoreObjectTypes, Typename extends KeyOf<ObjectTypes> = KeyOf<ObjectTypes>> {
  objects: Partial<{
    [key in Typename]: Record<string, ObjectTypes[key]>
  }> = {};

  private callbacks: RootStoreCallbacks<ObjectTypes, Typename> = {
    afterCreate: [],
    afterUpdate: []
  };

  public resolve<D extends object>(
    data: D,
    existingValue = {}
  ): DeepResolved<ObjectTypes, Typename, D> {
    let ownerObject: ObjectType | null = null;

    if (this.objectIsIdentifiable(data)) {
      const id = this.getObjectId(data);

      if (id) {
        ownerObject = this.find(this.getObjectTypename(data), id);
      }
    }

    const resolvedData = Object.entries(data).reduce((resolved, [key, value]) => {
      const existingValue = ownerObject?.[key];

      if (value && typeof value === 'object') {
        if (Array.isArray(value)) {
          resolved[key] = value.map((item, index) => {
            if (this.isResolvable(item)) {
              if (existingValue) {
                const existingItem = existingValue[index];

                return this.resolve(item, existingItem);
              }

              return this.resolve(item);
            } else {
              return item;
            }
          });
        } else {
          if (existingValue) {
            resolved[key] = this.resolve(value, existingValue);
            return resolved;
          }

          resolved[key] = this.resolve(value);
        }
      } else {
        resolved[key] = value;
      }

      return resolved;
    }, existingValue as any); // TODO: Types

    if (this.isResolvable(resolvedData)) {
      const typename = this.getObjectTypename(resolvedData);
      const id = this.getObjectId(resolvedData);

      if (id) {
        const existingObject = this.find(typename, id);

        if (existingObject) {
          return this.update(typename, id, resolvedData as any) as any;
        }
      }

      return this.create(typename, resolvedData as any) as any;
    }

    // TODO: Resolve 'as any' types

    return resolvedData;
  }

  public update<T extends Typename>(typename: T, id: string, data: ObjectTypes[T]) {
    const existingObject = this.find(typename, id);
    if (!existingObject) throw new Error('Instance not found'); // TODO: Better errors

    Object.assign(existingObject, data);

    return existingObject;
  }

  public create<T extends Typename>(typename: T, object: ObjectTypes[T]): ObjectTypes[T] {
    const store = this.getInstanceStore(typename);
    let id = this.getObjectId(object);

    if (!id) {
      id = this.generateModelId(typename);
    }

    if (this.find(typename, id)) {
      throw new Error('Instance already exists'); // TODO: Better errors
    }

    const observable = makeAutoObservable(object);

    store[id] = observable;
    observable.id = id;

    return observable;
  }

  public on(name: RootStoreCallbackName, callback: RootStoreCallback<ObjectTypes, Typename>) {
    this.callbacks[name].push(callback);

    return () => {
      this.callbacks[name].splice(this.callbacks[name].indexOf(callback), 1);
    }
  }

  private find<T extends Typename>(typename: T, id: string): ObjectTypes[T] | null {
    return this.getInstanceStore(typename)[id] || null;
  }

  private emit(name: RootStoreCallbackName, instance: ObjectTypes[Typename]) {
    this.callbacks[name].forEach((callback) => {
      callback(instance);
    });
  }

  private getObjectTypename(object: ObjectType): Typename {
    return object.__typename as Typename;
  }

  private objectIsIdentifiable(
    object: unknown
  ): object is IdentifiableObjectType {
    if (!object) return false;
    if (typeof object !== 'object') return false;

    return 'id' in object;
  }

  private getObjectId(object: unknown): string | null {
    try {
      if (!this.objectIsIdentifiable(object)) return null;

      const id = object.id;
      if (!id) return null;

      return id;
    } catch (err) {
      // TODO: Check for SelectionError, remove console.error
      console.error(err);
      return null;
    }
  }

  private getInstanceStore<T extends Typename>(typename: T): Record<string, ObjectTypes[T]> {
    return this.objects[typename] ||= {};
  }

  private isResolvable(data: unknown): data is IdentifiableObjectType {
    if (typeof data !== 'object' || data === null) return false;
    if (!('__typename' in data)) return false;

    return typeof data.__typename === 'string';
  }

  private generateModelId<T extends Typename>(typename: T) {
    const generate = () => `gid://depot/${typename}/${Math.random().toString(36).substring(2)}`;

    let idAttempt = generate();

    while (this.find(typename, idAttempt)) {
      idAttempt = generate();
    }

    return idAttempt;
  }
}

