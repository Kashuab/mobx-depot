import {UserQueryPayloadBaseModel} from "./UserQueryPayloadBaseModel";
import {makeModelObservable} from "../../makeModelObservable";

export class UserQueryPayloadModel extends UserQueryPayloadBaseModel {
  constructor(init: any) {
    super(init);

    makeModelObservable(this);
  }
}