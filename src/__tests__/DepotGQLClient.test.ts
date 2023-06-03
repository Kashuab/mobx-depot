import {DepotGQLClient} from "../DepotGQLClient";
import {mockGraphQLServer} from "./lib/test_utils/msw";
import { graphql } from 'msw';
import {RootStore} from "../RootStore";
import {UserModel} from "./lib/UserModel";
import { omit, cloneDeep } from 'lodash';

describe('DepotGQLClient', () => {
  const server = mockGraphQLServer();

  it('can cache a response from a server', async () => {
    const rootStore = new RootStore(() => ({ User: UserModel }), { idFieldName: 'id' });

    const userData = {
      user: {
        __typename: 'User',
        id: '1',
        firstName: 'Billy',
        lastName: 'Bob',
        metadata: {
          postCount: 3
        }
      }
    } as const;

    const updatedUserData = {
      user: {
        __typename: 'User',
        id: '1',
        firstName: 'Joe',
        lastName: 'Mama',
        metadata: {
          postCount: 5
        }
      }
    } as const;

    server.use(
      graphql.query('UserQuery', (req, res, ctx) => {
        return res(
          ctx.data(userData)
        )
      })
    )

    const client = new DepotGQLClient('http://localhost:4000/graphql', {}, rootStore);

    const queryDocument = `
      query UserQuery {
        user {
          id
          firstName
          lastName
          metadata {
            postCount
          }
        }
      }
    `;

    const iterator = client.request<typeof userData>({
      document: queryDocument
    });

    for await (const result of iterator) {
      expect(result.user).toMatchObject(omit(userData.user, '__typename'));
      expect(result.user).toBeInstanceOf(UserModel);
    }

    const [cacheKey, cachedUserQuery] = client.cache[0];

    expect(cacheKey).toBe(client.getCacheKey(queryDocument));
    expect(cachedUserQuery.user).toBe(rootStore.find(UserModel, '1'));

    server.use(
      graphql.query('UserQuery', (req, res, ctx) => {
        return res(
          ctx.data(updatedUserData)
        )
      })
    )

    const iterator2 = client.request({
      document: queryDocument
    });

    let results = [];

    for await (const result of iterator2) {
      results.push(cloneDeep(result));
    }

    // Default cache-and-network policy should yield two different results
    // What's cached, then the new result
    expect(results).toMatchObject([
      { user: omit(userData.user, '__typename') },
      { user: omit(updatedUserData.user, '__typename') }
    ]);
  });

  it('can update the cache with a mutation', async () => {
    const rootStore = new RootStore(() => ({ User: UserModel }), { idFieldName: 'id' });

    const userData = {
      user: {
        __typename: 'User',
        id: '1',
        firstName: 'Billy',
        lastName: 'Bob'
      }
    } as const;

    server.use(
      graphql.query('UserQuery', (req, res, ctx) => {
        return res(
          ctx.data(userData)
        )
      })
    );

    server.use(
      graphql.mutation('UpdateUserMutation', (req, res, ctx) => {
        const { input } = req.variables

        Object.assign(userData.user, input);

        return res(
          ctx.data(userData),
        )
      })
    );

    const client = new DepotGQLClient('http://localhost:4000/graphql', {}, rootStore);

    const queryDocument = `
      query UserQuery {
        user {
          id
          firstName
          lastName
        }
      }
    `;

    const iterator = client.request<typeof userData>({
      document: queryDocument
    });

    for await (const result of iterator) {
      // Do nothing
    }

    const instance = client.cache[0][1].user;
    expect(instance).toBeInstanceOf(UserModel);

    const mutationDocument = `
      mutation UpdateUserMutation($input: UpdateUserInput!) {
        updateUser(input: $input) {
          id
          firstName
          lastName
        }
      }
    `;

    const mutationIterator = client.request({
      document: mutationDocument,
      variables: {
        input: {
          firstName: 'Joe',
          lastName: 'Mama'
        }
      }
    });

    for await (const result of mutationIterator) {
      // Do nothing
    }

    const updatedInstance = client.cache[0][1].user;
    expect(updatedInstance).toBeInstanceOf(UserModel);
    expect(updatedInstance).toMatchObject({
      firstName: 'Joe',
      lastName: 'Mama'
    });

    // Make sure the instance is the same instance
    expect(updatedInstance).toBe(instance);

    // Make sure query cache contains updated data

    const queryIterator = client.request<typeof userData>({
      document: queryDocument
    });

    let results = [];

    // Cache hit and network request should return updated data as a result of the mutation
    for await (const result of queryIterator) {
      results.push(result);
      expect(result.user).toMatchObject({
        firstName: 'Joe',
        lastName: 'Mama'
      });
    }

    expect(results.length).toBe(2);
    expect(results[0].user).toBe(results[1].user);
  });
});

