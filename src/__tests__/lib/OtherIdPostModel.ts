import {UserModel} from "./UserModel";
import {assignInstanceProperties} from "../../lib/assignInstanceProperties";
import {Selectable} from "../../decorators/Selectable";
import {makeAutoObservable} from "mobx";

export class OtherIdPostModel {
  source: 'local' | 'remote' = 'local';
  __setSource(source: 'local' | 'remote') {
    this.source = source;
  }

  @Selectable() declare otherId: string;
  @Selectable() declare title: string;
  @Selectable() declare user: UserModel;

  constructor(init: any, makeObservable = true) {
    this.assign(init);

    if (makeObservable) makeAutoObservable(this);
  }

  assign(data: Partial<OtherIdPostModel>) {
    assignInstanceProperties(this, data);
  }
}