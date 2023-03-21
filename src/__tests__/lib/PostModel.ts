import {UserModel} from "./UserModel";
import {assignInstanceProperties} from "../../lib/assignInstanceProperties";

export class PostModel {
  source: 'local' | 'remote' = 'local';
  __setSource(source: 'local' | 'remote') {
    this.source = source;
  }

  id: string;
  title: string;
  user: UserModel;

  constructor(init: any) {
    this.id = init.id;
    this.title = init.title;
    this.user = init.user;
  }

  assign(data: Partial<PostModel>) {
    assignInstanceProperties(this, data);
  }
}