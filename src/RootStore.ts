import {Container} from "inversify";

export type RootStoreTypes = Record<string, symbol>

export class RootStore {
  container = new Container();

  constructor() {
  }
}