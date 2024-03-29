import {PostBaseModel} from "./PostBaseModel";
import {makeModelObservable} from "../../makeModelObservable";

export class PostModel extends PostBaseModel {
  constructor(init: any) {
    super(init);

    makeModelObservable(this);
  }
}