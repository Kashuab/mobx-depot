import {Container} from "inversify";

export type RootStoreTypes = Record<string, symbol>

interface IModel {
  new (...args: any[]): { id: string };
}

export class RootStore {
  container = new Container();
  models: Record<string, IModel> = {};

  constructor() {
  }

  register(model: IModel) {

  }
}