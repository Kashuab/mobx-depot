# `mobx-depot`

Scaffold your GraphQL schema into MobX-powered models, queries and mutations.

## Why?

My inspiration derives from [`mst-gql`](https://github.com/mobxjs/mst-gql). However, I've found many drawbacks:

- Local instantiation is difficult
  - Consider `User.create`, `user.set('email', ...)`, `user.save` in a `CreateUser` component
- Partially loaded data is annoying to handle
  - Having to do `someModel.hasLoaded('someField')` is cumbersome and uses no type predicates
- Not a fan of `mobx-state-tree`, classes are more intuitive to me
- Hasn't been updated in 7 months
  - Too lazy to worry about maintaining a fork, so I'm just going to do it myself. Makes sense, right? 

## What will it do?

Essentially the same thing as `mst-gql`, but with a few differences:

- No `mobx-state-tree` dependency
- Better handling of partial data
- Support for lifecycle of new data
