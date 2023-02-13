export class PostModel {
  properties: {
    __typename: 'PostModel';
    id: string;
    title: string;
  }

  constructor(properties: PostModel['properties']) {
    this.properties = properties;
  }
}