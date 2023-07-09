import {RootStore} from "../RootStore";

type RootStoreObjectTypes = {
  Post: {
    __typename: 'Post';
    id: string;
    title: string;
    comments: {
      __typename: 'Comment';
      content: string;
      createdAt: string;
    }[];
  };
  User: {
    __typename: 'User';
    id: string
    firstName: string
    lastName: string;
    posts: RootStoreObjectTypes['Post'][]
    metadata: RootStoreObjectTypes['UserMetadata'];
  };
  UserMetadata: {
    __typename: 'UserMetadata';
    lastOnlineAt: string | null;
    postCount: number | null;
  }
}

const createStore = () => new RootStore<RootStoreObjectTypes>();

describe('RootStore', () => {
  let store = createStore();

  beforeEach(() => {
    store = createStore();
  });

  it('can resolve simple data', () => {
    const resolved = store.resolve({
      user: {
        __typename: 'User',
        id: '1',
        firstName: 'John',
        posts: [],
      }
    } as const);

    expect(resolved.user).toEqual({
      __typename: 'User',
      id: '1',
      firstName: 'John',
      posts: [],
    });
  })

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
    } as const);

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

  it('deep merges resolved data', () => {
    const createUserPayload = store.resolve({
      createUser: {
        __typename: 'CreateUserPayload',
        user: {
          __typename: 'User',
          id: '1',
          firstName: 'Bing bong',
          posts: [
            {
              __typename: 'Post',
              id: '1',
              title: 'Hello world',
              comments: [
                {
                  __typename: 'Comment',
                  content: 'Comment one',
                },
                {
                  __typename: 'Comment',
                  content: 'Comment two',
                }
              ]
            }
          ],
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
          posts: [
            {
              __typename: 'Post',
              id: '1',
              title: 'Hello world',
              comments: [
                {
                  __typename: 'Comment',
                  createdAt: '2 days ago'
                },
                {
                  __typename: 'Comment',
                  createdAt: '3 days ago'
                }
              ]
            }
          ],
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
    expect(user.posts[0].comments[0].content).toBe('Comment one');
    expect(user.posts[0].comments[0].createdAt).toBe('2 days ago');
    expect(user.posts[0].comments[1].content).toBe('Comment two');
    expect(user.posts[0].comments[1].createdAt).toBe('3 days ago');
  });

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

  it('can reconcile arrays in RootStore.resolve', () => {
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

    store.resolve({
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
        },
        {
          __typename: 'Post',
          id: '4',
          title: 'Hello world 4',
        }
      ]
    } as const);

    expect(user.posts).toHaveLength(4);
    expect(user.posts[3].title).toBe('Hello world 4');

    store.resolve({
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

    store.resolve({
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
          id: '3',
          title: 'Hello world 3',
        }
      ]
    } as const);

    expect(user.posts).toHaveLength(2);
    expect(user.posts[0].title).toBe('Hello world');
    expect(user.posts[0].id).toBe('1');
    expect(user.posts[1].title).toBe('Hello world 3');
    expect(user.posts[1].id).toBe('3');

    store.resolve({
      __typename: 'User',
      id: '1',
      firstName: 'John',
      posts: []
    } as const);

    expect(user.posts).toHaveLength(0);
  })
});