import {assignInstanceProperties} from "../../lib/assignInstanceProperties";
import {Selectable} from "../../decorators/Selectable";
import {UserModel} from "./UserModel";
import {makeAutoObservable} from "mobx";

export class UserQueryPayloadModel {
  source: 'local' | 'remote' = 'local';
  __setSource(source: 'local' | 'remote') {
    this.source = source;
  }

  @Selectable() declare user: UserModel;

  constructor(init: any, makeObservable = true) {
    this.assign(init);

    if (makeObservable) makeAutoObservable(this);
  }

  assign(data: Partial<UserQueryPayloadModel>) {
    assignInstanceProperties(this, data);
  }
}