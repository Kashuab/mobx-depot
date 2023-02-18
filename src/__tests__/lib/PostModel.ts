import {UserModel} from "./UserModel";

export class PostModel {
  id: string;
  title: string;
  user: UserModel;

  constructor(init: any) {
    this.id = init.id;
    this.title = init.title;
    this.user = init.user;
  }
}