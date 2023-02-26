import {RootStore} from "../RootStore";
import {PostModel} from "./lib/PostModel";
import {UserModel} from "./lib/UserModel";
import {OtherIdPostModel} from "./lib/OtherIdPostModel";
import {OtherIdUserModel} from "./lib/OtherIdUserModel";

const createStore = <ID extends string>(idFieldName: ID) => new RootStore(() => ({
  User: UserModel,
  Post: PostModel,
}), { idFieldName });

describe('RootStore', () => {
  let store = createStore('id');

  beforeEach(() => {
    store = createStore('id');
  });

  it('can resolve a simple model', () => {
    const resolved = store.resolve({
      user: {
        __typename: 'User',
        id: '1',
        name: 'John',
      }
    } as const);

    expect(resolved.user).toBeInstanceOf(UserModel);
  })

  it('can deeply resolve data', () => {
    const resolved = store.resolve({
      createUser: {
        __typename: 'CreateUserPayload',
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
    expect(resolved.createUser.user.posts[0]).toBeInstanceOf(PostModel);
  });

  it('preserves array types', () => {
    const resolved = store.resolve({
      createUser: {
        __typename: 'CreateUserPayload',
        user: {
          __typename: 'User',
          id: '1',
          name: 'John',
          posts: [],
        }
      }
    } as const);

    expect(resolved.createUser.user.posts).toBeInstanceOf(Array);
  })

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
    expect(updatedUser.posts[0]).toBe(post);
    expect(updatedUser.posts[1]).toBe(secondPost);
  });

  it('can replace instances', () => {
    const userData = {
      __typename: 'User',
      id: '1',
      name: 'Kyle',
      posts: [
        {
          __typename: 'Post',
          id: '1',
          title: 'Bing bong'
        }
      ]
    } as const;

    const resolvedUser = store.resolve(userData);
    const originalPost = resolvedUser.posts[0];
    const newPost = new PostModel({ id: '__localModel', title: 'Woah!' });

    newPost.assign(originalPost);
    store.replace(originalPost, newPost);

    expect(resolvedUser.posts[0]).toBe(newPost);
    expect(store.get(PostModel, originalPost.id)).toBe(newPost);
  });

  it('deep merges resolved data', () => {
    const createUserPayload = store.resolve({
      createUser: {
        __typename: 'CreateUserPayload',
        user: {
          __typename: 'User',
          id: '1',
          name: 'Bing bong',
          metadata: {
            lastOnlineAt: 'now',
          }
        }
      }
    } as const);

    const updateUserPayload = store.resolve({
      updateUser: {
        __typename: 'UpdateUserPayload',
        user: {
          __typename: 'User',
          id: '1',
          metadata: {
            postCount: 0,
          }
        }
      }
    } as const);

    const user = createUserPayload.createUser.user;
    const updatedUser = updateUserPayload.updateUser.user;

    expect(user).toBe(updatedUser);
    expect(user.name).toBe('Bing bong');
    expect(user.metadata.lastOnlineAt).toBe('now');
    expect(user.metadata.postCount).toBe(0);
  });

  it('can handle different ID field names', () => {
    const otherIdStore = new RootStore(() => ({
      OtherIdUserModel,
      OtherIdPostModel,
    }), { idFieldName: 'otherId' });

    const user = otherIdStore.resolve({
      __typename: 'OtherIdUserModel',
      otherId: '1',
      name: 'John',
    });

    const postOneData = {
      __typename: 'OtherIdPostModel',
      otherId: '1',
      title: 'Hello world',
    } as const;

    const postTwoData = {
      __typename: 'OtherIdPostModel',
      otherId: '2',
      title: 'Hello world 2',
    } as const;

    const post = otherIdStore.resolve(postOneData);
    const secondPost = otherIdStore.resolve(postTwoData);

    const updatedUser = otherIdStore.resolve({
      __typename: 'OtherIdUserModel',
      otherId: '1',
      name: 'John (updated)',
      posts: [
        postOneData,
        postTwoData,
      ],
    } as const);

    expect(updatedUser).toBe(user);
    expect(updatedUser.posts[0]).toBe(post);
    expect(updatedUser.posts[1]).toBe(secondPost);
  })
});