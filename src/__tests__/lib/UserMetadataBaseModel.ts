import {assignInstanceProperties} from "../../lib/assignInstanceProperties";
import {Selectable} from "../../decorators/Selectable";

export class UserMetadataBaseModel {
  source: 'local' | 'remote' = 'local';
  __setSource(source: 'local' | 'remote') {
    this.source = source;
  }

  @Selectable() declare lastOnlineAt: string | null;
  @Selectable() declare postCount: number | null;

  constructor(init: any) {
    this.assign(init);
  }

  assign(data: Partial<UserMetadataBaseModel>) {
    assignInstanceProperties(this, data);
  }
}