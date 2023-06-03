import {action, autorun} from "mobx";

export type Castable<Model extends CastableModel> = {
  /**
   * This method, when invoked by `cast`, is wrapped in an `autorun` so that
   * when the original model updates, the casted instance will update as well.
   *
   * @param model
   */
  receiveModel(model: Model): void;
}

type CastableClass<Model extends CastableModel> = {
  new(model: Model): Castable<Model>;
}

type CastableModel = {}

const castedStore: [CastableModel, CastableClass<any>[], Castable<any>][] = [];

export function cast<
  Model extends CastableModel,
  Klasses extends CastableClass<Model>[]
>(model: Model, ...classes: Klasses): UnionToIntersection<InstanceType<Klasses[number]>> {
  const cached = castedStore.find(([m, klasses]) => {
    if (m !== model) return false;
    if (klasses.length !== classes.length) return false;
    for (const klass of klasses) {
      if (!classes.includes(klass)) return false;
    }

    return true;
  });

  if (cached) {
    return cached[2] as any;
  }

  const instances = classes.map(klass => new klass(model));

  // Create a proxy that behaves as if all the instances were combined
  const proxyInstance = new Proxy({}, {
    get(target, prop) {
      for (const instance of instances) {
        if (prop in instance) {
          const value = instance[prop as keyof typeof instance];

          if (typeof value === 'function') {
            return value.bind(instance);
          }

          return value;
        }
      }
    },
    set(target, prop, value) {
      for (const instance of instances) {
        if (prop in instance) {
          action(() => {
            console.log('Setting', prop, 'to', value, 'on', instance);
            instance[prop as keyof typeof instance] = value;
          });
        }
      }
      return true;
    }
  }) as any;

  castedStore.push([model, classes, proxyInstance]);

  // When the original model updates, update each instance
  autorun(() => {
    instances.forEach(instance => {
      instance.receiveModel(model);
    })
  });

  return proxyInstance;
}

type UnionToIntersection<T> =
  (T extends any ? (x: T) => any : never) extends
    (x: infer R) => any ? R : never