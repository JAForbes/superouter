## superouter

```typescript
import * as superouter from "superouter";

const route = superouter.type("Example", {
  Home: (_: { organization_id: string }) => [_, `/:organization_id`],
  Group: (_: { organization_id: string; group_id: string }) => [
    _,
    `/:organization_id/groups/:group_id`,
  ],
});

route.Home({ organization: "hi" }); // Type error: No property named organization

route.Home({ organization_id: 4 }); // Type error: Expected string instead of number

route.Group({ organization_id: "1" }); // Type error: Expected property group_id:string

route.toPath(route.Group({ organization_id: "1", group_id: "2" }));
//=> /1/groups/2

route.fromPath("/1/groups/2");
//=> { type: 'Example', tag: 'Group', value: { organization_id: '1', group_id: '2' } }

route.isGroup(route.fromPath("/1/groups/2"));
//=> true

route.isHome(route.fromPath("/1/groups/2"));
//=> false
```

## Quick start

```bash
npm install superouter@next
```

## What

A router that encourages you to use names and types instead of dealing with URL strings in your application logic.

- Modern: Re-designed to take advantage of modern Typescript features
- Small: < 500 LOC (8kb unminifed, 3.7kb minified)
- Simple: No state, no history API, just data
- Fast: Simple pattern matching rules with a single pass parser
- Specific: Matches the most specific route, not just an order dependent regex

## Why

> 🤖 Warning: Wall of text!!!

Route state is the primary state in your application. If we derive state from the URL we automatically get deep linkable/sharable apps. We can cold boot our apps from the URL state and not have to click multiple times to get back to what we were doing during development. Relying on a URL state as the foundation of your app state leads to a better experience for users and developers and it forces us to think about what is the total possibility space for a particular screen ahead of time.

> 💣 Warning: Rant imminent!!!

Advancements in hot module reloading has potentially misguided us into focusing too much on DX and not UX. If we refresh the app constantly we are forced to experience load times, and route navigations repeatedly - just like a user. So let's fix the actual problem by embedding more state in the URL instead of hiding it behind fancy tools.

> 🔥🔥🔥 Warning: Hot take!!!

If we are going to rely on route state so much, then we should probably not do stringly typed checks against URL pathnames. We should instead match on data.

---

_superouter_ gives you a data-centric experience for dealing with route state. _superouter_ instances are just data, they have no instance methods, you can store them in localStorage, in your state management library, in your database etc - this is by design.

This library is deliberately small and simple. You are encouraged to build specific niceties on top of _superouter_ for your framework of choice.

Hopefully _superouter_ also models route state as a tagged union type. The API offers affordances to match on route state and handle each case specifically with the data that is expected for that given state. This is more reliable than adhoc ternaries / if statements that match on specific URL paths and aren't updated as your route definitions organically evolve.

## API

### Creating a route type:

First we define the supertype. We do so via the `superouter.type` function. The first argument is the name of your route. The name is there so you can have different route types for different parts of your app and each route type is incompatible with the others methods.

The second argument is a record where the key is the name of the route and the value is a function: `<T>(value:T) => [T, string]`.

_superouter_ analyzes your definition via `Parameters<Definition>` to infer the structure of each route subtype.

The function takes the arguments you expect to parse from your URL pattern and returns the pattern that will be used to parse the URL string.

```js
const route = superouter.type("Example", {
  Home: (_: { organization_id: string }) => `/:organization_id`,
  Group: (_: { organization_id: string, group_id: string }) =>
    `/:organization_id/groups/:group_id`,
});
```

In the above example, typescript now knows `route.Group` can only be constructed with both an `organization_id` and a `group_id` whereas `Route.Home` only needs an `organization_id`. We also generate helper methods, and typescript knows this dynamic methods exist e.g. `isGroup` or `isHome`.

> 🤓 We call `Example` our supertype, and `Example.Group` and `Example.Home` our subtypes.

### `is[Tag]`

```typescript
Example.isA(Example.A({ a_id: "cool" }));
// => true

Example.isA(Example.C({}));
// => false
```

For every subtype of your route there is a generated route to extract if a specific instance has that tag.

> You can also just check the `.tag` property on the route instance

### `get[Tag]`

```typescript
Example.getA(0, (x) => Number(x.a_id), Example.A({ a_id: "4" }));
// => 4

Example.getA(0, (x) => Number(x.a_id), Example.B({ b_id: "2" }));
// => 0
```

For every subtype of your route there is a generated route to extract a value from a specific route. You also pass in a default value to ensure you are handling every case.

> You can also access the `.value` property on the route instance but you'd have to type narrow on tag anyway, this is likely more convenient.

### `match`

```typescript
const Example = superouter.type("Example", {
  A: (_: { a_id: string }) => `/a/:a_id`,
  B: (_: { b_id: string }) => `/b/:b_id`,
  C: (_: { c_id?: string }) => [`/c`, "/c/:c_id"],
});

type Instance = superouter.Instance<typeof Example>;

const f = (route: Instance) =>
  Example.match(route, {
    A: ({ a_id }) => Number(a_id),
    B: ({ b_id }) => Number(b_id),
    C: ({ c_id }) => (c_id ? Number(c_id) : 0),
  });

f(Example.A({ a_id: "4" }));
//=> 4

f(Example.B({ b_id: "2" }));
//=> 2

f(Example.C({ c_id: "100" }));
//=> 100

f(Example.C({}));
//=> 0
```

Convert a route type into another type by matching on every value. In the avove example we're converting all routes to a `number`.

`.match` is a discriminated union, which means you are forced to handle every case, if a case is missing, it won't typecheck.

### `otherwise`

```typescript
// This example extends the above `match` example.

// Create a function that handles cases B and C
const _ = Example.otherwise(["B", "C"]);

//
const g = (r: Instance) =>
  Example.match(r, {
    A: () => 1,

    // B and C will be -1
    ..._(() => -1),
  });

g(Example.A({ a_id: "cool" }));
//=> 1

g(Example.B({ b_id: "cool" }));
//=> -1

g(Example.C({ c_id: "cool" }));
//=> -1
```

`.otherwise` is a helper to be used in combination with `.match`. It allows you to select a subset of routes and handle them uniformly. You can then mix in this default set into a match.

In the context of routing this is useful when there are sets of similar routes within a larger superset, e.g. routes related to auth/access, or routes that may not have some meta context like an `organization_id`.

### `type.toPath`

```typescript
Example.toPath(Example.A({ a_id: "cool" }));
//=> /a/cool
```

Attempts to transform an instance of your route supertype into a path segment according to patterns specified in the definition.

If it cannot satisfy the patterns you specified with the values available on the object it will throw.

This may happen if your types are out of sync with your patterns.

### `type.fromPath`

```typescript
Example.fromPath("/a/cool");
//=> Example.A({ a_id: 'cool' })

Example.fromPath("/incorrect/non/matching/path");
//=> throw new Error(
//      'Expected binding for path variable ':a_id' but instead found nothing'
//   )
```

### `type.toPathSafe`

```typescript
Example.fromPathSafe(Example.A({ a_id: "cool" }));
//=> { type: 'Either', tag: 'Right', value: { a_id: 'cool' } }

Example.fromPathSafe({ type: "A", tag: "A", value: { a_id: "" } });
//=> { type: 'Either'
//   , tag: 'Left'
//   , value:
//      new Error(
//          'Expected binding for path variable ':a_id' but instead found nothing'
//      )
//   }
```

Largely an internal method but provided for those who'd like to avoid exceptions wherever possible.

Attempts to transform an instance of your route supertype into a path segment according to patterns specified in the definition.

If it can satisfy the patterns you specified it will return an `Either.Right` of your path (e.g. `Either.Right('/a/cool')`)

If it cannot satisfy the patterns you specified with the values available on the object it will return `Either.Left(new Error(...))`.

This may happen if your types are out of sync with your patterns.

If `Either` is an unfamiliar data structure, I recommend having a read of [The Perfect API](https://james-forbes.com/posts/the-perfect-api)

> To extract the value from the either instance, simply check the `tag` and then conditionally access `.value` to get either the path or the error.

### `type.fromPathSafe`

```typescript
Example.fromPathSafe("/a/cool");
//=> { type: 'Either', tag: 'Right', value: Example.A({ a_id: 'cool' }) }

Example.fromPathSafe("/incorrect/non/matching/path");
//=> { type: 'Either'
//   , tag: 'Left'
//   , value:
//      new Error(
//          'Expected binding for path variable ':a_id' but instead found nothing'
//      )
//   }
```

Largely an internal method but provided for those who'd like to avoid exceptions wherever possible.

Attempts to transform a path segment into a subtype of your route using the pattern definition supplied when the type was created.

If it can satisfy the patterns you specified it will return an `Either.Right` of your route instance (e.g. `Either.Right(Either.A({ a_id: 'cool' }))`)

If it cannot satisfy the patterns you specified with the values available on the object it will return `Either.Left(new Error(...))`.

This may happen if your types are out of sync with your patterns.

If `Either` is an unfamiliar data structure, I recommend having a read of [The Perfect API](https://james-forbes.com/posts/the-perfect-api)

> To extract the value from the either instance, simply check the `tag` and then conditionally access `.value` to get either the path or the error.

### `type.patterns`

An index of all the URL patterns provided at definition time.

```typescript
const Example = superouter.type("Example", {
  A: (_: { a_id: string }) => `/a/:a_id`,
  B: (_: { b_id: string }) => `/b/:b_id`,
  C: (_: { c_id?: string }) => [`/c`, "/c/:c_id"],
});

Example.patterns;
// => {
//     A: ['/a/:a_id'],
//     B: ['/b/:b_id'],
//     C: ['/c', '/c/:c_id']
// }
```

> Note the structure has normalized all values to be an array of patterns even if only one was provided.

### `type.definition`

Returns the definition object you passed in when initialized the type. This is useful for extracting type information about each route subtype. You can also use this to access the patterns for each route subtype, but its better to do so via `type.patterns` as you are guaranteed to get a normalized array of patterns even if in the definition you only configured a single item.

## Type helpers

### `Tag`

Extracts the possible tags from either a *superouter* sum type or a *superouter* instance type:

```typescript
const a = Example.A({ a_id: "cool" });

// A union of all possible values for `Example` e.g. 'A' | 'B' | 'C'
type All = superouter.Value<typeof Example>;

// Exactly 'A'
type One = superouter.Value<typeof a>;
```

### `Value`

Extracts the possible values from either a *superouter* sum type or a *superouter* instance type:

```typescript
const a = Example.A({ a_id: "cool" });

// A union of all possible values for `Example`
type All = superouter.Value<typeof Example>;

// Exactly { a_id: 'cool' }
type One = superouter.Value<typeof a>;
```

### `Instance`

```typescript
const Example = superouter.type("Example", {
  A: (_: { a_id: string }) => `/a/:a_id`,
  B: (_: { b_id: string }) => `/b/:b_id`,
  C: (_: { c_id?: string }) => [`/c`, "/c/:c_id"],
});

// The type of a route instance for your specific type
type Instance = superouter.Instance<typeof Example>;

// Use it for typing your own custom route utils
const yourFunction = (example: Instance) => example.tag;
```

## FAQ

### Why didn't you use `path-to-regexp` (et al) to parse the route patterns?

We were intending on doing exactly that, thinking it would be faster and support more features. But given `path-to-regexp` supports so many features, it would be difficult to determine the pattern match rank for all the variations.

*superouter* instead has a very simple pattern language: you have literals and variables and patterns always accept extra segments. This makes for simpler ranking system. We're yet to need more power than that in route pattern matching for web apps.

Finally it is also harder to get useful feedback about why something failed or didn't match when using Regular Expressions. Superouter has a very simple single pass parser that gives the user helpful feedback when a match couldn't be made. With regexp when something doesn't match you don't get a lot of insight into what you did wrong.

## Advanced / Fun

### How does ranking work

While matching a path we increment a score value using the following rules:

| Type of match              | Score            |
| -------------------------- | ---------------- |
| Extra fragments after path | `max(0,score-1)` |
| `/:variable`               | `2`              |
| `/literal`                 | `4`              |

`fromPath` / `fromPathSafe` and `toPath` / `toPathSafe` use the same logic to pick the winning route / url.

### Supporting multiple patterns per sub type

```js
const Example = type("Example", {
  A: (x: { a_id?: string }) => [`/example/a/:a`, `/example/a`],
  B: (x: { b_id: string }) => `/example/b/:b`,
});
```

Note in the above example we are returning a list of possible patterns for `A`: [`/example/a/:a`, `/example/a`]. This means if we hit `/example/a` and there is no binding for `/:a` we still get a match and *superouter* will return a value object of `{}`

Because we are matching a pattern that has no bindings we make the type of `a_id` optional: `{ a_id?: string }`. Unfortunately we can't enforce this kind of relationship within typescript so you'll have to be diligent when defining your route defintions to keep your types and your patterns in sync.

### Framework example: Integrating with Mithril's router

A route supertype returns its patterns and names via `type.patterns`, it also returns the original definition you passed in as `type.definition`

We can use this metadata to both typecheck an index of `Route: Component` and then reference that index against its url patterns so we get an index of `Pattern: Component`.

From there we can thread that through to the framework API (in this case mithril's `m.route`)

```typescript
const Example = type("Example", {
  Welcome: (x: { name?: string }) => [`/welcome/:name`, `/welcome`],
  Login: (x: { error?: string }) => [`/login/error/:error`, `/login`],
});

// Rough type definition of mithril component
type Component<T> = (v: { attrs: T }) => { view: (v: { attrs: T }) => any };

type Value = superouter.Value;

// example instances we can use with `Value`
const welcome = Example.Welcome({ name: 'cool' })
const login = Example.Login({})

const WelcomeComp: Component<Value<typeof welcome>> = () => ({
  view: (v) => `Welcome ${v.attrs.name ?? "User"}`,
});
const LoginComp: Component<Value<typeof example>> = () => ({
  view: (v) => [
    v.attrs.error ? "There was an error: " + v.attrs.error : null,
    "Please login using your username and password.",
  ],
});

type Components<D extends Definition> = {
  [K in keyof D]: Component<Parameters<D[K]>[0]>;
};

const Components: Components<Example> = {
  Welcome: WelcomeComp,
  Login: LoginComp,
};

m.route(
  document.body,
  "/login",
  Object.fromEntries(
    Object.entries(Example.patterns).flatMap(([k, v]) =>
      v.map((v2) => [v2, Components[k]])
    )
  )
);
```

Effectively we're zipping together the patterns with their corresponding mithril components. We're also using the route definition to parameterize the mithril components. So if we change our route definition without updating our component we will get a useful type error.

The final definition would be equivalent to hardcoding this:

```typescript
m.route(
  document.body,
  "/login",
  {
    '/welcome/:name': WelcomeComp,
    '/login/error/:error': LoginComp
    '/login': LoginComp
  }
);
```

But the above could easily drift  out of sync as you add / remove more patterns for a given route case.

Note the same is possible for any framework , but our iteration would instead return the contract expected there e.g.

```typescript
createBrowserRouter([...etc, {
    path: pattern,
    element: ReactComponent,
}])
```

### Nested / Dynamic routes

*superouter* is stateless, it never touches your browser `history` object or peeks into `window.location`. It is up to you to decide what path segument you pass in.

This means you can have different *superouter* instances aribtarily at different depths within your application, and you just need to either include the full prefix path in the definition, or remove the redundant repeating part of the pathname that you pass in for a nested route.

As to how you should bind that into your framework of choice, that is up to you. All *superouter* does is help with the representation of data and the corresponding type checks and information.

## ESLint / Typescript complaining about no-unused-vars in route definitions

You can optionally return the input argument as part of the tuple to silence this warning "natively" e.g.

```typescript
superouter.type("Example", {
  A: (x: { a_id: string }) => `/:a_id`,
});
```

Alternatively you can name the var `_` and then tell ESLint to never warn about unused variables matching that pattern:

```json
{
  "rules": {
    "@typescript-eslint/no-unused-vars": [
      "error",
      { "varsIgnorePattern": "_", "argsIgnorePattern": "_" }
    ]
  }
}
```

If you have that configured, you can skip returning the input argument which is equivalent but arguably cleaner:

```typescript
superouter.type("Example", {
  A: (_: { a_id: string }) => `/:a_id`,
});
```

## Enforcing route definitions that can handle any path segment

*superouter* deliberately allows you to create route definitions that assume specific path literals without a fallback. This avoids a lot of needless checking in nested routes when it wouldn't make sense for the literal prefix to exist.

But if you would like to guarantee your code can handle arbitrary paths, simply call `fromPath('/')` immediately after defintion. Then your code will throw if the definition is not total.

```typescript
const Example = superouter.type("Example", {
  A: (_: { a_id: string }) => `/a/:a_id`,
  B: (_: { b_id: string }) => `/b/:b_id`,
  C: (_: { c_id?: string }) => [`/c`, "/c/:c_id"],
});

// will throw, doesn't match any case
Example.fromPath("/");
```

vs

```typescript
const Example = superouter.type("Example", {
  A: (_: { a_id: string }) => `/a/:a_id`,
  B: (_: { b_id: string }) => `/b/:b_id`,
  C: (_: { c_id?: string }) => [`/c`, "/c/:c_id"],
  Default: (_: {}) => `/`,
});

// will not throw, matches 'Default' case
Example.fromPath("/");
// => { type: 'Example', tag: 'Default', value: {} }
```
