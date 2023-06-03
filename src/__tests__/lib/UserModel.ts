import {PostModel} from "./PostModel";
import {assignInstanceProperties} from "../../lib/assignInstanceProperties";
import {UserMetadataModel} from "./UserMetadataModel";
import {Selectable} from "../../decorators/Selectable";
import {makeAutoObservable} from "mobx";

export class UserModel {
  source: 'local' | 'remote' = 'local';
  __setSource(source: 'local' | 'remote') {
    this.source = source;
  }

  @Selectable() declare id: string
  @Selectable() declare firstName: string
  @Selectable() declare lastName: string;
  @Selectable() declare posts: PostModel[]
  @Selectable() declare metadata: UserMetadataModel;

  constructor(init: any, makeObservable = true) {
    this.assign(init);

    if (makeObservable) makeAutoObservable(this);
  }

  assign(data: Partial<UserModel>) {
    assignInstanceProperties(this, data);
  }
}