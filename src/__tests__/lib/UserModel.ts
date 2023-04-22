import {UserBaseModel} from "./UserBaseModel";
import {makeModelObservable} from "../../makeModelObservable";

export class UserModel extends UserBaseModel {
  constructor(init: any) {
    super(init);

    makeModelObservable(this);
  }
}