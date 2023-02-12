import {RootStore, RootStoreTypes} from "../../src/RootStore";

const TYPES: RootStoreTypes = {
  User: Symbol.for("User")
}

export const rootStore = new RootStore(TYPES);