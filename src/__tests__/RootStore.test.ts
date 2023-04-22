import {RootStore} from "../RootStore";
import {PostModel} from "./lib/PostModel";
import {UserModel} from "./lib/UserModel";
import {OtherIdPostModel} from "./lib/OtherIdPostModel";
import {OtherIdUserModel} from "./lib/OtherIdUserModel";
import {UserMetadataModel} from "./lib/UserMetadataModel";
import {UserQueryPayloadModel} from "./lib/UserQueryPayloadModel";

const createStore = <ID extends string>(idFieldName: ID) => new RootStore(() => ({
  User: UserModel,
  Post: PostModel,
  UserMetadata: UserMetadataModel,
  UserQueryPayload: UserQueryPayloadModel,
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
        firstName: 'John',
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
          firstName: 'John',
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
          firstName: 'John',
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
      firstName: 'John',
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
      firstName: 'John (updated)',
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
      firstName: 'Kyle',
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
    expect(newPost.id).toBe(originalPost.id);

    store.replace(originalPost, newPost);

    expect(resolvedUser.posts[0]).toBe(newPost);
    expect(store.find(PostModel, originalPost.id)).toBe(newPost);
  });

  it('deep merges resolved data', () => {
    const createUserPayload = store.resolve({
      createUser: {
        __typename: 'CreateUserPayload',
        user: {
          __typename: 'User',
          id: '1',
          firstName: 'Bing bong',
          metadata: {
            __typename: 'UserMetadata',
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
            __typename: 'UserMetadata',
            postCount: 0,
          }
        }
      }
    } as const);

    const user = createUserPayload.createUser.user;
    const updatedUser = updateUserPayload.updateUser.user;

    expect(user).toBe(updatedUser);
    expect(user.firstName).toBe('Bing bong');
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
      firstName: 'John',
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
      firstName: 'John (updated)',
      posts: [
        postOneData,
        postTwoData,
      ],
    } as const);

    expect(updatedUser).toBe(user);
    expect(updatedUser.posts[0]).toBe(post);
    expect(updatedUser.posts[1]).toBe(secondPost);
  });

  it('can return a list of instances by a given predicate', () => {
    const posts = [
      {
        __typename: 'Post',
        id: '1',
        title: 'Hello world',
      },
      {
        __typename: 'Post',
        id: '2',
        title: 'Hello world 2',
      },
      {
        __typename: 'Post',
        id: '3',
        title: 'Hello world 3',
      },
      {
        __typename: 'Post',
        id: '4',
        title: 'Something else',
      }
    ];

    store.resolve(posts);

    const foundPosts = store.where(PostModel, (post) => post.title.includes('Hello world'));

    expect(foundPosts).toHaveLength(3);
    expect(foundPosts[0].title).toBe('Hello world');
    expect(foundPosts[1].title).toBe('Hello world 2');
    expect(foundPosts[2].title).toBe('Hello world 3');
  });

  it('can find a single instance by a given predicate', () => {
    const posts = [
      {
        __typename: 'Post',
        id: '1',
        title: 'Hello world',
      },
      {
        __typename: 'Post',
        id: '2',
        title: 'Hello world 2',
      },
      {
        __typename: 'Post',
        id: '3',
        title: 'Hello world 3',
      },
      {
        __typename: 'Post',
        id: '4',
        title: 'Something else',
      }
    ];

    store.resolve(posts);

    const foundPost = store.findBy(PostModel, (post) => post.title.includes('Hello world 2'));
    if (!foundPost) {
      throw new Error('Post not found');
    }

    expect(foundPost).toBeDefined();
    expect(foundPost).toBeInstanceOf(PostModel);
    expect(foundPost.title).toBe('Hello world 2');
  });

  it('can return a list of instances by a given model', () => {
    const posts = [
      {
        __typename: 'Post',
        id: '1',
        title: 'Hello world',
      },
      {
        __typename: 'User',
        id: '3',
        firstName: 'John',
      },
      {
        __typename: 'Post',
        id: '2',
        title: 'Hello world 2',
      },
      {
        __typename: 'User',
        id: '4',
        firstName: 'Joe',
      }
    ];

    store.resolve(posts);

    const foundPosts = store.findAll(PostModel);

    expect(foundPosts).toHaveLength(2);
    expect(foundPosts[0].title).toBe('Hello world');
    expect(foundPosts[1].title).toBe('Hello world 2');
  });

  it('can remove an instance', () => {
    const user = store.resolve({
      __typename: 'User',
      id: '1',
      firstName: 'John',
      posts: [
        {
          __typename: 'Post',
          id: '1',
          title: 'Hello world',
        },
        {
          __typename: 'Post',
          id: '2',
          title: 'Hello world 2',
        },
        {
          __typename: 'Post',
          id: '3',
          title: 'Hello world 3',
        }
      ]
    } as const);

    const postToRemove = user.posts[1];
    store.remove(postToRemove);

    expect(store.find(PostModel, '2')).toBe(null);
    expect(user.posts).toHaveLength(2);
    expect(user.posts[0].title).toBe('Hello world');
    expect(user.posts[1].title).toBe('Hello world 3');
  })

  it('can deeply merge data with assign', () => {
    const user = new UserModel({
      metadata: new UserMetadataModel({
        lastOnlineAt: 'now',
        postCount: 3
      })
    });

    user.assign({
      metadata: new UserMetadataModel({
        lastOnlineAt: null,
        postCount: 3
      })
    });

    expect(user.metadata.lastOnlineAt).toBeNull();
  })

  it('can deeply update data with store.resolve', () => {
    const { userQuery } = store.resolve({
      userQuery: {
        __typename: 'UserQueryPayload',
        user: {
          __typename: 'User',
          id: '1',
          metadata: {
            __typename: 'UserMetadata',
            lastOnlineAt: 'now',
            postCount: 3
          }
        }
      }
    } as const);

    const { user } = userQuery;

    expect(user.metadata.lastOnlineAt).toBe('now')
    expect(user.metadata.postCount).toBe(3)

    store.resolve({
      userQuery: {
        __typename: 'UserQueryPayload',
        user: {
          __typename: 'User',
          id: '1',
          metadata: {
            __typename: 'UserMetadata',
            lastOnlineAt: null,
            postCount: 3
          }
        }
      }
    } as const);

    expect(user.metadata.lastOnlineAt).toBeNull();
    expect(user.metadata.postCount).toBe(3)
  });
});