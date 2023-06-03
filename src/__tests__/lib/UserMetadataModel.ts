import {assignInstanceProperties} from "../../lib/assignInstanceProperties";
import {Selectable} from "../../decorators/Selectable";
import {makeAutoObservable} from "mobx";

export class UserMetadataModel {
  source: 'local' | 'remote' = 'local';
  __setSource(source: 'local' | 'remote') {
    this.source = source;
  }

  @Selectable() declare lastOnlineAt: string | null;
  @Selectable() declare postCount: number | null;

  constructor(init: any, makeObservable = true) {
    this.assign(init);

    if (makeObservable) makeAutoObservable(this);
  }

  assign(data: Partial<UserMetadataModel>) {
    assignInstanceProperties(this, data);
  }
}