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

const castedStore: [CastableModel, CastableClass<any>, Castable<any>][] = [];

export function cast<Model extends CastableModel, Klass extends CastableClass<Model>>(model: Model, Class: Klass): InstanceType<Klass> {
  const cached = castedStore.find(([m, Klass]) => m === model && Klass === Class);
  if (cached) {
    return cached[2] as InstanceType<Klass>;
  }

  const instance = new Class(model);
  castedStore.push([model, Class, instance]);

  // When the original model updates, update the instance
  autorun(() => {
    instance.receiveModel(model);
  });

  return instance as InstanceType<Klass>;
}