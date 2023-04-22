import {UserMetadataBaseModel} from "./UserMetadataBaseModel";
import {makeModelObservable} from "../../makeModelObservable";

export class UserMetadataModel extends UserMetadataBaseModel {
  constructor(init: any) {
    super(init);

    makeModelObservable(this);
  }
}