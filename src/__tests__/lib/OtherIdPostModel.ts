import {UserModel} from "./UserModel";
import {assignInstanceProperties} from "../../lib/assignInstanceProperties";
import {Selectable} from "../../decorators/Selectable";

export class OtherIdPostModel {
  source: 'local' | 'remote' = 'local';
  __setSource(source: 'local' | 'remote') {
    this.source = source;
  }

  @Selectable() declare otherId: string;
  @Selectable() declare title: string;
  @Selectable() declare user: UserModel;

  constructor(init: any) {
    this.assign(init);
  }

  assign(data: Partial<OtherIdPostModel>) {
    assignInstanceProperties(this, data);
  }
}