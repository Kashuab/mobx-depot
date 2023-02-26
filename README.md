# `mobx-depot`

Scaffold MobX-powered models, queries and mutations with your GraphQL schema.

- [NPM](https://www.npmjs.com/package/mobx-depot) ![npm version](https://badgen.net/npm/v/mobx-depot)
- [Bundlephobia](https://bundlephobia.com/package/mobx-depot) ![gzip size](https://badgen.net/bundlephobia/minzip/mobx-depot) ![tree shaking](https://badgen.net/bundlephobia/tree-shaking/mobx-depot)

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

Depending on the structure of your schema, you could also consider local state management as a target. Soon we'll be
able to generate code from a `schema.graphql` file, of which you could generate models from without needing to 
interact with an external API at all. In this case any local state management library should be shaking in their boots!

- Redux
- Zustand
- 

## Expect trouble

Until this library is published on NPM with version `>=0.1.0`, expect trouble. There are many "pre-release" issues
that still need to be tackled and tests to be written before I recommend usage. That being said, `mobx-depot` may "just work" for you.

If you do run into any bugs, please [create an issue](https://github.com/Kashuab/mobx-depot/issues)!

If you're interested in contributing, hit me up on [Twitter](https://twitter.com/kyle_helium).
I won't have any formal guidelines for contributing until after the first release, as I want to ensure
my vision for the library is clear before I start accepting PRs. Though I'm totally up to review some PRs for bug fixes!

## Limitations

As is common in early development, there are currently a slew of limitations that will be addressed in the future:

- Only TypeScript supported
- React utilities are always generated, this is planned to be optional
- Must provide a URL for introspection, providing a `schema.graphql` file is not supported
- Object types in your schema must include an `id: String!` field
- GraphQL Subscriptions are not supported
- Object types cannot include the following field names: `set`, `selectedData`, `assign`, and `store` (see [issue #22](https://github.com/Kashuab/mobx-depot/issues/22))
- Probably more things that I'm not aware of yet

# Getting started

Assuming you already have `react` installed...

- `yarn add mobx-depot mobx graphql graphql-request`

Next, add enable experimental decorators to your `tsconfig.json`:

```json
{
  ... // other config
  "compilerOptions": {
    ... // other options
    "experimentalDecorators": true
  }
}
```

## Generate code

- `yarn mobx-depot generate http://localhost:3000/graphql --outDir src/models`

This will generate a `src/models` directory with the following structure:

- `depot` (Don't touch anything in here. `generate` will overwrite this whole directory!)
  - `base`
    - `XBaseModel.ts`
    - `YBaseModel.ts`
    - `ZBaseModel.ts`
  - `inputs` 
    - `SomeOperationInput.ts`
  - `mutations`
    - `SomeOperationMutation.ts`
  - `queries`
    - `SomeOperationQuery.ts`
  - `hooks.ts`
  - `rootStore.tsx`
  - `scalars.ts`
- `XModel.ts` (You can edit these!)
- `YModel.ts`
- `ZModel.ts`

## Setup your app root

Your app will have some sort of `src/App.tsx`. You will need to:

- Initialize a `GraphQLClient` from `graphql-request`
- Pass the client into `setGraphQLClient` exported from the generated root store (`models/depot/rootStore`)

```tsx
import { GraphQLClient } from "graphql-request";
import { setGraphQLClient } from './models/depot/rootStore';

// This may be different if you're not using Vite, or have some other environment variable for this.
const API_URL = import.meta.env.VITE_API_URL;

const client = new GraphQLClient(API_URL);

setGraphQLClient(client);

export const App = () => {
  return (
    <div className="App">
      {/* ... */}
    </div>
  )
}
```

Now you're ready to get cooking! 

## Customizing models

After running the `generate` command with our CLI, each object type in your schema gets turned into two things:
a `Model`, and its `BaseModel`. The `BaseModel` provides setters and getters for data provided by GraphQL. **Do not
make changes to any `BaseModel` class!** `mobx-depot` will overwrite them when running `generate`.

Here's an example of a generated `Model`:

```tsx
// src/models/TodoModel.ts
import { makeModelObservable } from 'mobx-depot';
import { TodoBaseModel } from './depot/base/TodoBaseModel';

// Feel free to edit this class :)
export class TodoModel extends TodoBaseModel {
  constructor(init: Partial<TodoModel> = {}) {
    super(init);
    
    makeModelObservable(this);
  }
}
```

> **Note:** You shouldn't have to touch the constructor. If you do, make sure the first argument remains
> `Partial<TodoModel>`. The `RootStore` relies on this argument in order to resolve new instances.

Let's assume that the `Todo` type looks like this:

```graphql
type Todo {
  id: ID!
  title: String!
  content: String!
  completedAt: String
  dueBy: String!
  createdAt: String!
  updatedAt: String!
}
```

You'll find all of these properties accessible on `this`. Let's add a getter that tells us if the `todo` is complete:

```tsx
export class TodoModel extends TodoBaseModel {
  constructor(init: Partial<TodoBaseModel> = {}) {
    super(init);
    
    makeModelObservable(this);
  }
  
  get isComplete() {
    return !!this.completedAt;
  }
}
```

## Querying data with `useQuery`

Let's get some todos.

```tsx
// src/components/TodoList.tsx
import { observer } from 'mobx-react-lite';
import { useQuery } from "mobx-depot";
import { TodosQuery } from '../models/depot/queries/TodosQuery';

export const TodoList = observer(() => {
  const { data, loading } = useQuery(() => new TodosQuery(todo => todo.title.content));
  
  return (
    <div className="TodoList">
      {data?.todos.map(todo => ( // NOTE! `todo` is a `TodoModel` :D
        <div className="Todo">
          <h1>{todo.title}</h1>
          <p>{todo.content}</p>
        </div>
      ))}
    </div>
  )
});
```

## Partial data

What makes GraphQL so great is its ability to only give you the data you need. You can see that we only selected
`title` and `content` from each `todo`. If we wanted to use the `todo.isCompleted` getter we added earlier, it would
return `false` since the data isn't there, right? RIGHT??

**WRONG!** The `TodoBaseModel`'s generated getter would _**throw an error**_ stating that the field hasn't been selected.
This is ideal, as it stops you in your tracks instead of letting it silently produce an invalid result.

For example:

```tsx
// src/components/TodoList.tsx
import { observer } from 'mobx-react-lite';
import { useQuery } from "mobx-depot";
import { TodosQuery } from '../models/depot/queries/TodosQuery';

export const TodoList = observer(() => {
  const { data, loading } = useQuery(() => new TodosQuery(todo => todo.title.content));
  
  return (
    <div className="TodoList">
      {data?.todos.map(todo => ( // NOTE! `todo` is a `TodoModel` :D
        <div className="Todo">
          <h1>{todo.title}</h1>
          <p>{todo.content}</p>
          <span>{todo.isCompleted ? 'Completed!': 'Incomplete'}</span>
        </div>
      ))}
    </div>
  )
});
```

Trying to render this component would result in a thrown error when the query is done:
`Error: Property completedAt is not selected`

It's able to tell because `todo.completedAt` is explicitly `undefined`. If it were selected but were empty,
it would be `null` instead.

To fix this, add `.completedAt` to the selection builder:

```tsx
const { data, loading } = useQuery(() => new TodosQuery(todo => todo.title.content.completedAt));
```

I find that adding queries to static methods within the most relevant `Model` is a good way to keep things organized:

```tsx
// src/models/TodoModel.ts

export class TodoModel extends TodoBaseModel {
  static findAll() {
    return new TodosQuery(todo => todo.title.content.completedAt);
  }
  
  constructor(init: Partial<TodoBaseModel> = {}) {
    super(init);
    
    makeModelObservable(this);
  }
}
```

```tsx
const { data, loading } = useQuery(() => TodoModel.findAll());
```

Be wary of adding too many queries to a single `Model`. A good rule of thumb is to use a static method for general
queries that can be used across the app, and keep highly specific queries local to where they're needed (i.e. component,
hook, some instance method elsewhere.)

## Selecting "primitives"

It's common to select all the fields from a type that don't reference another model. For example, given this schema:

```graphql
type Todo {
  id: ID!
  title: String!
  content: String!
  completedAt: String
  dueBy: String!
  user: User!
  createdAt: String!
  updatedAt: String!
}

type User {
  id: ID!
  name: String!
  email: String!
}
```

You can select `title`, `content`, `completedAt`, `dueBy`, `createdAt` and `updatedAt` all by adding `primitives` to
your selection builder:

```tsx
export class TodoModel extends TodoBaseModel {
  static findAll() {
    return new TodosQuery(todo => todo.primitives);
  }
  
  // ... other methods
}
```

This also works with nested types, of course:

```tsx
export class TodoModel extends TodoBaseModel {
  static findAll() {
    return new TodosQuery(todo => todo.primitives.user(user => user.primitives));
  }
  
  // ... other methods
}
```

If you're using a supported IDE, you can hover over `primitives` to see the fields it will add to your query.

### Beware of using `primitives` outside of components

When all your models always select `primitives` from their queries, you can end up over-saturating your views with data.
If you want to optimize this and provide your components with a way to only select the data they need, you can offer an
optional argument to manually provide a selection builder:

```tsx
import { TodoSelectionBuilder } from './depot/base/TodoBaseModel';

export class TodoModel extends TodoBaseModel {
  static findAll(select: TodoSelectionBuilder = todo => todo.primitives) {
    return new TodosQuery(select);
  }
  
  // ... other methods
}
```


## Mutations with `useMutation`

Let's update a `todo`!

```tsx
import { observer } from 'mobx-react-lite';
import { TodoModel } from '../models/TodoModel';
import { useMutation } from "mobx-depot";

type EditTodoFormProps = {
  todo: TodoModel;
}

export const EditTodoForm = observer(({ todo }: EditTodoFormProps) => {
  const { data, loading, dispatch } = useMutation(
    () => new UpdateTodoMutation(
      { id: todo.id, todo: { title: todo.title, content: todo.content } },
      todo => todo.title.content,
    ),
    {
      onSuccess: (data) => {
        console.log(data);
        alert('Updated todo!')
      },
    }
  );
  
  return (
    <div className="EditTodoForm">
      {loading && <p>Loading...</p>}
      
      <input value={todo.title} onChange={e => todo.set('title', e.target.value)} />
      <textarea value={todo.content} onChange={e => todo.set('content', e.target.value)} />
      
      <button onClick={dispatch}>Save</button>
    </div>
  )
});
```

> **Note:** See our usage of `todo.set`? The `set` method comes from `TodoBaseModel` as a built-in action.

I heavily recommend putting the `UpdateTodoMutation` instantiation within a method on your model. This keeps components
dumb!

```tsx
// src/models/TodoModel.ts
import { UpdateTodoMutation } from '../models/depot/mutations/UpdateTodoMutation';

export class TodoModel extends TodoBaseModel {
  constructor(init: Partial<TodoBaseModel> = {}) {
    super(init);

    makeModelObservable(this);
  }

  get isComplete() {
    return !!this.completedAt;
  }
  
  save() {
    return new UpdateTodoMutation(
      { title: this.title, content: this.content },
      todo => todo.title.content
    );
  }
}
```

```tsx
// src/components/EditTodoForm.tsx

...

export const EditTodoForm = observer(({ todo }: EditTodoFormProps) => {
  const { data, loading, dispatch } = useMutation(() => todo.save(), {
    onSuccess: (data) => {
      console.log(data);
      alert('Updated todo!')
    },
  });
  
  return (
    <div className="EditTodoForm">
      {loading && <p>Loading...</p>}
      
      <input value={todo.title} onChange={e => todo.set('title', e.target.value)} />
      <textarea value={todo.content} onChange={e => todo.set('content', e.target.value)} />
      
      <button onClick={dispatch}>Save</button>
    </div>
  )
});
```

> **Note:** Do not pass `todo.save` directly into `useMutation` (`useMutation(todo.save)`). This will cause the method to lose its context,
> thus any usage of `this` will inevitably fail. Use an arrow function, or bind the method to the instance.
> (i.e. `() => todo.save()`, `todo.save.bind(todo)`)

You can `dispatch` the `Mutation` if your model needs to handle the response, however it gets a bit interesting:

```tsx
export class TodoModel extends TodoBaseModel {
  constructor(init: Partial<TodoBaseModel> = {}) {
    super(init);

    makeModelObservable(this);
  }

  get isComplete() {
    return !!this.completedAt;
  }

  save() {
    const mutation = new UpdateTodoMutation(
      { title: this.title, content: this.content },
      todo => todo.title.content
    );
    
    mutation.mutate().then(todo => {
      // Handle the result
    });
    
    return mutation;
  }
}
```

> **NOTE: You do not need to manually update your instance.** If your instance knows its ID (which is automatically selected by
> generated queries/mutations,) and the GraphQL query returns that same ID in the payload the `RootStore` will
> automatically reconcile the data in any existing instances.

As you can see, the `save` method stays synchronous so it can return the `mutation` to the `useMutation` hook.
This allows your components to stay updated when the state of the `mutation` changes.

However, if you don't plan on handling the intermediate state of the mutation, you can use `async/await`:

```tsx
export class TodoModel extends TodoBaseModel {
  constructor(init: Partial<TodoBaseModel> = {}) {
    super(init);

    makeModelObservable(this);
  }

  get isComplete() {
    return !!this.completedAt;
  }

  async save() {
    const mutation = new UpdateTodoMutation(
      { title: this.title, content: this.content },
      todo => todo.title.content
    );
    
    await mutation.mutate();
  }
}
```

> **Note: `useMutation` does not work with async functions.** Its sole purpose is to handle the lifecycle of a mutation.
> If you're handling it yourself by `await`ing the `mutate` method, it's expected that you're handling the result on
> your own.

## Referential stability

Any data that comes from a `Query` or `Mutation` class is resolved through a `RootStore`. It deeply finds objects
with a `__typename` that matches one of your generated models. If it finds one it will instantiate it. However, if 
the object also has an `id` field, it will try to find the existing instance in the store, update it, and use that one
instead.

[See the tests for `RootStore`](src/__tests__/RootStore.test.ts) for a better understanding. More thorough docs on this
coming soon.

# Gotchas

## `makeModelObservable`

You may have noticed that generated models use `makeModelObservable` from `mobx-depot` instead of `makeAutoObservable`.
MobX has limitations regarding the use of `makeAutoObservable` with subclasses. `makeModelObservable` works around this
limitation by determining the required annotations by traversing over `this` and its prototypes, then providing them to
`makeObservable`.

**Do not use this in your own code.** This works for us because:

- We're not extending an external class
- `BaseModel`s are designed to be inherited from, and are not meant to be instantiated directly

See relevant MobX discussion: https://github.com/mobxjs/mobx/discussions/2850#discussioncomment-5022315

### `wontfix`

I'd like to emphasize [@urugator's comment](https://github.com/mobxjs/mobx/discussions/2850#discussioncomment-498925):

> [...] this is not a suggested way to go, therefore I don't want to promote it in any way. Whatever you expose, some
> people will use it, twist it, misuse it, and in the end it will always come back to you, no matter the warnings.
> Automatic behavior provides convenience for common/simple cases. If it can't support inheritance reliably, the
> responsible thing to do is either not introducing automatic behavior in the first place (no longer an option) or to
> forbid cases that could lead to issues.
> 
> I am quite convinced that the cost of using makeObservable instead of makeAutoObservable (or even better getting rid
> of inheritance) for these ~10 classes , will be lower than the cost of introducing and maintaining any workaround.

Any usage of `makeModelObservable` outside of the sole purpose of extending `BaseModel`s is unsupported. Any issues
regarding non-generated usage of `makeModelObservable` will be closed as `wontfix`.

I have yet to find a case where this doesn't work. If you do, _please open an issue!_ 







