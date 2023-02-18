import {PostModel} from "./PostModel";

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
}