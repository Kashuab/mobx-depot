# This project is no longer maintained.

I tried using this, and while it did work out the result was less stellar than expected.
`mobx-depot` could definitely be improved in order to be feasible. [I have a few ideas on this](https://www.notion.so/MobX-Depot-Proposal-v0-1-0-5c40dd3192b24ef7885e88f8a525794f),
however my team is not considering GraphQL for our own application stack for the future. If there is any interest in the project,
I would love to work on it and perhaps implement those changes.

---

# `mobx-depot`

[View documentation](https://mobx-depot.dev)

Scaffold MobX-powered models, queries and mutations with your GraphQL schema.

- [NPM](https://www.npmjs.com/package/mobx-depot) ![npm version](https://img.shields.io/npm/v/mobx-depot?style=for-the-badge)
- [Bundlephobia](https://bundlephobia.com/package/mobx-depot) ![gzip size](https://img.shields.io/bundlephobia/minzip/mobx-depot?style=for-the-badge)

## What do you get?

- Strictly-typed `Model`, `Query` and `Mutation` classes auto-generated via introspection
- A `RootStore` to reconcile data from your API, preserving existing instances along the way
- A place to add your own logic to models that won't get overwritten by code generation
- Reactivity powered by [MobX](https://mobx.js.org/)
- A UI framework-agnostic solution, though first-class support for React is provided via hooks

### Which libraries is `mobx-depot` adjacent to?

- Apollo client
- `mst-gql`
- ...

Depending on the structure of your schema, you could also consider local state management as a target. You could
theoretically generate models using a schema without needing to interact with an external API at all. 

- Redux
- Zustand
- The other 10,000+ libraries out there

## Expect trouble

Until this library is published on NPM with version `>=0.1.0`, expect trouble. There are many "pre-release" issues
that still need to be tackled and tests to be written before I recommend usage. That being said, `mobx-depot` may "just work" for you.

If you do run into any bugs, please [create an issue](https://github.com/Kashuab/mobx-depot/issues)!

If you're interested in contributing, hit me up on [Twitter](https://twitter.com/kyle_helium).
I won't have any formal guidelines for contributing until after the first release, as I want to ensure
my vision for the library is clear before I start accepting PRs. Though I'm totally up to review some PRs for bug fixes!

## Limitations

As is common in early development, there are limitations that will be addressed in the future:

- Only TypeScript supported
- GraphQL Subscriptions are not supported

Looking for the docs? [View documentation](https://mobx-depot.dev)
