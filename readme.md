## superouter

```typescript
import * as superouter from "superouter";

const route = superouter.create({

  Home: (_: { 
    organization_id: string 
  }) => `/:organization_id`,

  Group: (_: { 
    organization_id: string; 
    group_id: string 
  }) => `/:organization_id/groups/:group_id`,

});

// Typescript: No property named organization
route.Home({ organization: "hi" }); 

// Typescript: Expected string instead of number
route.Home({ organization_id: 4 }); 

// Typescript: Expected property group_id:string
route.Group({ organization_id: "1" }); 

route.toPath(
  route.Group({ 
    organization_id: "1", 
    group_id: "2" 
  })
);
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

### UX over DX

Advancements in hot module reloading has potentially misguided us into focusing too much on DX and not UX. If we refresh the app constantly we are forced to experience load times, and route navigations repeatedly - just like a user. If we fix the actual problem (resumable state) by embedding more state in the URL instead of hiding it behind fancy tools both user and develop benefits.

### Route state deserves to be structured ### 

Route state is the primary state in your application. If we derive state from the URL we automatically get deep linkable/sharable apps. We can cold boot our apps from the URL state and not have to click multiple times to get back to what we were doing during development. Relying on URL state as the foundation of your app state leads to a better experience for users and developers and it forces us to think about what is the total possibility space for a particular screen ahead of time.


If we are going to rely on route state so much, then we should probably not do stringly typed checks against URL pathnames. We should instead match on data.

### Serializable by Design

_superouter_ instances are just data, they have no instance methods.  This is useful for recovering route state.  You can store complete rich data routes in localStorage, your state management library or your database.


### Tagged Unions

Superouter treats route states as separate possible states within a tagged union.  Each state gets a name, and your app logic can switch behaviour / rendering based on that tag instead of looking at URL strings.

The only place in your codebase that should need to deal with URLs is in the definition of your superouter type.

## API

### Creating a route type:

First we define the route type. We do so via the `superouter.create` function. The first argument is the name of your route, but if you skip it, we name the route `Main`.

The second argument is a record where the key is the name of the route and the value is a function: `<T>(value:T) => string` or just a `string` if theres no data to be passed from the url template.

The function should specify the shape of the data that can be parsed from the url fragment.

```js
const route = 
  superouter.create({

    Home: (_: { organization_id: string }) => 
      `/:organization_id`,
  
    Group: (_: { 
      organization_id: string, 
      group_id: string 
    }) => `/:organization_id/groups/:group_id`,

  });
```

We use this type and pattern information to build the constructors for each route member type, and various utils.

E.g. in the above example, typescript now knows `route.Group` can only be constructed with both an `organization_id` and a `group_id` whereas `Route.Home` only needs an `organization_id`.

> 🤓 We call `Example` our route type, and `Example.Group` and `Example.Home` our member types.

### `is[Tag]`

```typescript
Example.isA(Example.A({ a_id: "cool" }));
// => true

Example.isA(Example.C({}));
// => false
```

For every member type of your route there is a generated route to extract if a specific instance has that tag.

> You can also just check the `.tag` property on the route instance

### `get[Tag]`

```typescript
Example.getA(
  0
  , (x) => Number(x.a_id)
  , Example.A({ a_id: "4" })
);
// => 4

Example.getA(
  0
  , (x) => Number(x.a_id)
  , Example.B({ b_id: "2" })
);
// => 0
```

For every member type of your route there is a generated route to extract a value from a specific route. You also pass in a default value to ensure you are handling every case.

> You can also access the `.value` property on the route instance but you'd have to type narrow on tag anyway, this is likely more convenient.

### `match`

```typescript
const Example = superouter.create({
  A: (_: { a_id: string }) => `/a/:a_id`,
  B: (_: { b_id: string }) => `/b/:b_id`,
  C: (_: { c_id?: string }) => [`/c`, "/c/:c_id"],
});

const f = 
  Example.match({
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

Convert a route type into another type by matching on every value. In the above example we're converting all routes to a `number`.

### `otherwise`

```typescript
// This example extends the above `match` example.

// Create a function that handles cases B and C
const _ = Example.otherwise(["B", "C"]);

// B and C are handled by _(...)
// so we only need to specify A
// typescript will complain if you 
// haven't handled all the cases
const g = 
 Example.match({
   // B and C will be -1
    ..._(() => -1),
    A: () => 1,
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

Example.toPath(Example.A({ a_id: "" }));
//=> 
// throw new Error(
//   `Expected binding for path literal ':a_id' 
//    but instead found nothing`
// )
```

Attempts to transform an instance of your route route type into a path segment according to patterns specified in the definition.

If it cannot satisfy the patterns you specified with the values available on the object it will throw.

This may happen if your types are out of sync with your patterns.

> Note any excess path segments on `instance.context.rest` will be appended to the resulting path and normalized

### `type.fromPath`

```typescript
Example.fromPath("/a/cool");
//=> Example.A({ a_id: 'cool' })

Example.fromPath(
  "/incorrect/non/matching/path"
);
//=> 
//  throw new Error(
//    `Expected binding for path literal '/a' 
//     but instead found '/incorrect'`
//  )
```

> Note any excess path segments will appear on `.instance.context.rest`


### `type.toPathSafe`

```typescript
Example.toPathSafe(Example.A({ a_id: "cool" }));
//=> /a/cool

Example.toPathsafe({ 
  type: "A", tag: "A", value: { a_id: "" } 
});
//=> { type: 'Either'
//   , tag: 'Left'
//   , value:
//      new Error(
//          'Expected binding for path variable ':a_id' 
//           but instead found nothing'
//      )
//   }
```

Largely an internal method but provided for those who'd like to avoid exceptions wherever possible.

Attempts to transform an instance of your route route type into a path segment according to patterns specified in the definition.

If it can satisfy the patterns you specified it will return an `Either.Right` of your path (e.g. `Either.Right('/a/cool')`)

If it cannot satisfy the patterns you specified with the values available on the object it will return `Either.Left(new Error(...))`.

This may happen if your types are out of sync with your patterns.

If `Either` is an unfamiliar data structure, I recommend having a read of [The Perfect API](https://james-forbes.com/posts/the-perfect-api)

> To extract the value from the either instance, simply check the `tag` and then conditionally access `.value` to get either the path or the error.

> Note any excess path segments on `instance.context.rest` will be appended to the resulting path and normalized

### `type.fromPathSafe`

```typescript
Example.fromPathSafe("/a/cool");
//=> { type: 'Either', tag: 'Right', value: Example.A({ a_id: 'cool' }) }

Example.fromPathSafe("/incorrect/non/matching/path");
//=> { type: 'Either'
//   , tag: 'Left'
//   , value:
//      new Error(
//          `Expected binding for path literal '/a' but instead found '/incorrect'`
//      )
//   }
```

Largely an internal method but provided for those who'd like to avoid exceptions wherever possible.

Attempts to transform a path segment into a member type of your route using the pattern definition supplied when the type was created.

If it can satisfy the patterns you specified it will return an `Either.Right` of your route instance (e.g. `Either.Right(Either.A({ a_id: 'cool' }))`)

If it cannot satisfy the patterns you specified with the values available on the object it will return `Either.Left(new Error(...))`.

This may happen if your types are out of sync with your patterns.

If `Either` is an unfamiliar data structure, I recommend having a read of [The Perfect API](https://james-forbes.com/posts/the-perfect-api)

> To extract the value from the either instance, simply check the `tag` and then conditionally access `.value` to get either the path or the error.

> Note any excess path segments will appear on `.instance.context.rest`

### `type.patterns`

An index of all the URL patterns provided at definition time.

```typescript
const Example = superouter.create({
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

> Note the structure is normalized so that all values are an array of patterns even if only one string pattern was provided.

### `type.definition`

Returns the definition object you passed in when initialized the type. This is useful for extracting type information about each route member type. You can also use this to access the patterns for each route member type, but its better to do so via `type.patterns` as you are guaranteed to get a normalized array of patterns even if in the definition you only configured a single item.

### `instance.context.rest`

Any excess unmatched URL fragments will appear on the parsed `instance.context.rest` property.

### `instance.context.patterns`

The local url patterns for that specific tag

### `instance.context.localPatterns`

The parent url patterns.

## Nested routes

*superouter* has first class for nested routes.

To create a nested type in superouter, you call `.create` on the constructor for the member type of the parent route.

```typescript
const Root = superouter.create({
    Redirect: "/",
    LoggedIn: (_: { organization_id: string }) => 
      "/:organization_id",
});

const LoggedIn = Root.LoggedIn.create({
  Admin: "/admin",
  Projects: "/projects",
});

const Admin = LoggedIn.Admin.create({
  Organizations: "/organizations",
  Roles: (_: { role_id: string }) => "/roles/:role_id",
  Groups: (_: { group_id: string }) => "/groups/:group_id",
});
```

Child route constructors know the type requirements for their parent routes, and inheirt the same requirements.

So if we try to create an `Admin.Groups` route without specifying an `organization_id` we will get a type error:

```typescript
// Typescript knows the parent route needs an org id:

// TypeError: 
Admin.Groups({ group_id: "contractors" }) 

// All good:
Admin.Groups({ 
  group_id: "contractors", organization_id: "harth" 
})
```

The type requirements cascade arbitrarily through any number of subroute types.

### `toPath`

`toPath` works just like it does on a normal top level route.  This will produce a complete url path that could be added to `window.location.pathname`

### `toLocalPath`

We can also create just the local path fragment if we want:

```typescript

const example = Admin.Groups({ 
  group_id: "contractors", organization_id: "harth" 
})

Admin.toLocalPath(example)
// => '/groups/contractors'
```

### `fromPath`

`fromPath` works just like it does on a normal top level route.  This will parse a complete url path that could be source from `window.location.pathname`.

### `fromLocalPath`

A local path fragment may not have sufficient information to satisfy the top level type constraints.  So to parse a local path you need to provide an object of default values:

```typescript
Admin.fromLocalPath(
  '/groups/amazing'
  , { organization_id: 'brilliant' }
)
// =>
// Admin.Groups({ 
//   organization_id: 'brilliant', 
//   group_id: 'amazing'
// })
```

Note we did not need to provide a default value for `group_id` or `role_id`, just parent route type constraints.

## Type helpers

### `Tag`

Extracts the possible tags from either a *superouter* sum type or a *superouter* instance type:

```typescript
const a = Example.A({ a_id: "cool" });

// A union of all possible values for `Example` e.g. 'A' | 'B' | 'C'
type All = superouter.Tag<typeof Example>;

// Exactly 'A'
type One = superouter.Tag<typeof a>;
```

### `Value`

Extracts the possible values from 

- a route type 
- a instance type
- a member type constructor type

```typescript
const a = Example.A({ a_id: "cool" });

// A union of all possible values for `Example`
type All = superouter.Value<typeof Example>;

// Exactly { a_id: 'cool' }
type One = superouter.Value<typeof a>;

// Slightly broader: { a_id: string }
type OneAgain = superouter.Value<typeof Example.A>
```

### `Instance`

```typescript
const Example = superouter.create({
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

*superouter* instead has a very simple pattern language: you have literals and variables and patterns always accept extra segments. This makes for a simpler ranking system.

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

### Supporting multiple patterns per member type

```js
const Example = type("Example", {
  A: (x: { a_id?: string }) => 
    [`/example/a/:a`, `/example/a`],
  B: (x: { b_id: string }) => `/example/b/:b`,
});
```

Note in the above example we are returning a list of possible patterns for `A`: [`/example/a/:a`, `/example/a`]. This means if we hit `/example/a` and there is no binding for `/:a` we still get a match and *superouter* will return a value object of `{}`

Because we are matching a pattern that has no bindings we make the type of `a_id` optional: `{ a_id?: string }`. Unfortunately we can't enforce this kind of relationship within typescript so you'll have to be diligent when defining your route defintions to keep your types and your patterns in sync.

### Framework example: Integrating with Mithril's router

This isn't meant to be a plug n' play example, this is more a high level example to show what is possible.  You could also use `Route.patterns` to built a traditional mithril `m.route` object.


```typescript
const Route = superouter.create({

  Welcome: (x: { name?: string }) => 
    [`/welcome/:name`, `/welcome`],

  Login: (x: { error?: string }) => 
    [`/login/error/:error`, `/login`],

});

type Route = superouter.Instance<typeof Route>

// Rough type definition of mithril component
type Component<T> = 
  (v: { attrs: T }) => 
    { view: (v: { attrs: T }) => any };

// Extract the component attributes from the route
type WelcomeAttrs = superouter.Value<typeof Route.Welcome>
type LoginAttrs = superouter.Value<typeof Route.Login>

// Use them:
const WelcomeComp: Component<WelcomeAttrs> = () => ({
  view: (v) => 
    `Welcome ${v.attrs.name ?? "User"}`,
});

// Use them:
const LoginComp: Component<LoginAttrs> = () => ({
  view: (v) => [
    v.attrs.error 
    ? "There was an error: " + v.attrs.error : null,
    "Please login using your username and password.",
  ],
});


// parse the initial route
let route = Route.fromPath(window.location.pathname);

window.history.onpopstate = () => {
  // parse subsequent routes
  route = Route.fromPath(window.location.pathname)
  m.redraw()
}

// a util you can extend to generate the attrs for an anchor tag
let link = (options: { route: Route, replace?: boolean }) => 
  ({
    onclick(e){
      e.preventDefault()
      let method = replace ? 'replaceState' : 'pushState'
      window.history[method]('', null, Route.toPath(route))
    },
    href: Route.toPath(route)
  })

// Usage:
// m('a', link({ route: Route.Welcome({ name: 'James' }) }), 'Home')

m.mount(document.body, () => {
  view: () => 
    Route.match( route, {
      Welcome: attrs => m(WelcomeComp, attrs),
      Login: attrs => m(LoginComp, attrs)
    })
})
```

This is just one interpretation.  You really are in full control, all superouter does is encode/decode route patterns/state.  The way you integrate it into your own framework is up to you.

## ESLint / Typescript complaining about no-unused-vars in route definitions

You can optionally return the input argument as part of the tuple to silence this warning "natively" e.g.

```typescript
superouter.create({
  A: (x: { a_id: string }) => [x, [`/:a_id`]],
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
superouter.create({
  A: (_: { a_id: string }) => `/:a_id`,
});
```

## Usage from JS

In JS we can't (officially) annotate our types, but type inference will still kick in if use default values:


```js
const route = superouter.create({

  Home: (_={ 
    organization_id:''
  }) => `/:organization_id`,

  Group: (_={ 
    organization_id: ''; 
    group_id: ''
  }) => `/:organization_id/groups/:group_id`,

});

```

In an editor like VS Code, you won't get type errors, but you will get type completion when creating routes and dealing with route instances.