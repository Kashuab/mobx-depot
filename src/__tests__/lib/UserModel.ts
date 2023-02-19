import {PostModel} from "./PostModel";
import {assignInstanceProperties} from "../../lib/assignInstanceProperties";

export class UserModel {
  id: string
  name: string
  posts: PostModel[]
  metadata: {
    lastOnlineAt: string;
    postCount: number;
  }

  constructor(init: any) {
    this.id = init.id;
    this.name = init.name;
    this.posts = init.posts;
    this.metadata = init.metadata;
  }

  assign(data: Partial<UserModel>) {
    assignInstanceProperties(this, data);
  }
}