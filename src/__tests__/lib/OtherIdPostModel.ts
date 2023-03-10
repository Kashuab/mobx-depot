import {UserModel} from "./UserModel";
import {assignInstanceProperties} from "../../lib/assignInstanceProperties";

export class OtherIdPostModel {
  otherId: string;
  title: string;
  user: UserModel;

  constructor(init: any) {
    this.otherId = init.otherId;
    this.title = init.title;
    this.user = init.user;
  }

  assign(data: Partial<OtherIdPostModel>) {
    assignInstanceProperties(this, data);
  }
}