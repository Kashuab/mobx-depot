import {PostModel} from "./PostModel";
import {assignInstanceProperties} from "../../lib/assignInstanceProperties";

export class OtherIdUserModel {
  otherId: string
  name: string
  posts: PostModel[]
  metadata: {
    lastOnlineAt: string;
    postCount: number;
  }

  constructor(init: any) {
    this.otherId = init.otherId;
    this.name = init.name;
    this.posts = init.posts;
    this.metadata = init.metadata;
  }

  assign(data: Partial<OtherIdUserModel>) {
    assignInstanceProperties(this, data);
  }
}