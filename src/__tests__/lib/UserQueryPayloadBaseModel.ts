import {assignInstanceProperties} from "../../lib/assignInstanceProperties";
import {Selectable} from "../../decorators/Selectable";
import {UserModel} from "./UserModel";

export class UserQueryPayloadBaseModel {
  source: 'local' | 'remote' = 'local';
  __setSource(source: 'local' | 'remote') {
    this.source = source;
  }

  @Selectable() declare user: UserModel;

  constructor(init: any) {
    this.assign(init);
  }

  assign(data: Partial<UserQueryPayloadBaseModel>) {
    assignInstanceProperties(this, data);
  }
}