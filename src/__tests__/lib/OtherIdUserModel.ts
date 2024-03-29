import {PostModel} from "./PostModel";
import {assignInstanceProperties} from "../../lib/assignInstanceProperties";
import {Selectable} from "../../decorators/Selectable";
import {UserMetadataModel} from "./UserMetadataModel";

export class OtherIdUserModel {
  source: 'local' | 'remote' = 'local';
  __setSource(source: 'local' | 'remote') {
    this.source = source;
  }

  @Selectable() declare otherId: string
  @Selectable() declare name: string
  @Selectable() declare posts: PostModel[]
  @Selectable() declare metadata: UserMetadataModel;

  constructor(init: any) {
    this.assign(init);
  }

  assign(data: Partial<OtherIdUserModel>) {
    assignInstanceProperties(this, data);
  }
}