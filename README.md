# `mobx-depot`

Scaffold MobX-powered models, queries and mutations with your GraphQL schema.

## We're not ready yet.

Until this library is published on NPM with version `>=0.1.0`, please don't use it.

If you're interested in contributing, hit me up on [Twitter](https://twitter.com/kyle_helium).
I won't have any formal guidelines for contributing until after the first release, as I want to ensure
my vision for the library is clear before I start accepting PRs.

## Why?

My inspiration derives from [`mst-gql`](https://github.com/mobxjs/mst-gql). However, I've found many drawbacks:

- Local instantiation is difficult
  - Consider `User.create`, `user.set('email', ...)`, `user.save` in a `CreateUser` component
- Partially loaded data is annoying to handle
  - Having to do `someModel.hasLoaded('someField')` is cumbersome and uses no type predicates
- Not a fan of `mobx-state-tree`, classes are more intuitive to me
- Hasn't been updated in 7 months
  - Too lazy to worry about maintaining a fork, so I'm just going to build an entirely new library. Makes sense, right? 

## What will it do?

Essentially the same thing as `mst-gql`, but with a few differences:

- No `mobx-state-tree` dependency
- Better handling of partial data
- Support for lifecycle of new data
