import {PostModel} from "./PostModel";

export class UserModel {
  properties: {
    __typename: 'UserModel';
    id: string
    name: string
    posts: PostModel[]
  }

  constructor(properties: UserModel['properties']) {
    this.properties = properties;
  }
}