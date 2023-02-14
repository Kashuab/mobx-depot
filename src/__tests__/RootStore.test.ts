import {GQLData, RootStore} from "../RootStore";
import {PostModel} from "./lib/PostModel";
import {UserModel} from "./lib/UserModel";

const createStore = () => new RootStore({
  User: UserModel,
  Post: PostModel,
});

describe('RootStore', () => {
  let store = createStore();

  beforeEach(() => {
    store = createStore();
  });

  it('can resolve a simple model', () => {
    const resolved = store.resolve({
      __typename: 'User',
      id: '1',
      name: 'John',
    } as const);

    expect(resolved).toBeInstanceOf(UserModel);
  })

  it('can deeply resolve data', () => {
    const resolved = store.resolve({
      createUser: {
        user: {
          __typename: 'User',
          id: '1',
          name: 'John',
          posts: [
            {
              __typename: 'Post',
              id: '1',
              title: 'Hello world',
            },
            {
              __typename: 'Post',
              id: '2',
              title: 'Hello world',
            },
          ],
        }
      }
    } as const);

    expect(resolved.createUser.user).toBeInstanceOf(UserModel);
    expect(resolved.createUser.user.properties.posts[0]).toBeInstanceOf(PostModel);
  });

  it('can retain references', () => {
    const user = store.resolve({
      __typename: 'User',
      id: '1',
      name: 'John',
    });

    const postOneData = {
      __typename: 'Post',
      id: '1',
      title: 'Hello world',
    } as const;

    const postTwoData = {
      __typename: 'Post',
      id: '2',
      title: 'Hello world 2',
    } as const;

    const post = store.resolve(postOneData);
    const secondPost = store.resolve(postTwoData);

    const updatedUser = store.resolve({
      __typename: 'User',
      id: '1',
      name: 'John (updated)',
      posts: [
        postOneData,
        postTwoData,
      ],
    } as const);

    expect(updatedUser).toBe(user);
    expect(updatedUser.properties.posts[0]).toBe(post);
    expect(updatedUser.properties.posts[1]).toBe(secondPost);
  })
});