superouter
----------

[![pipeline status](https://gitlab.com/harth/superouter/badges/master/pipeline.svg)](https://gitlab.com/harth/superouter/commits/master)



[![coverage report](https://gitlab.com/harth/superouter/badges/master/coverage.svg)](https://gitlab.com/harth/superouter/commits/master)

Quick Start
===========

`npm install superouter`

```jsx
const superouter = require('superouter')

const Route = 
    superouter.type('Route', {
        Home: '/',
        Post: '/posts/:post',
        Settings: '/settings/...rest'
    })

Route.of.Home() 
//=> { type: 'Route', case: 'Home' }
Route.of.Post({ post }) 
//=> { type: 'Route', case: 'Post', value: { post }}
Route.of.Settings({ rest: '/a/b/c' })
// => { type: 'Route', case: 'Settings', value: 'rest' }

const view = 
    Route.fold(
        { Home: () => <Home/>
        , Post: ({ post }) => <Post post={post} />
        , Settings: ({ rest }) => <Settings subpath={rest} />
        }
    )

view ( Route.of.Home() ) //=> <Home />

Route.matchOr( Route.of.Home(), '/settings/1/2/3' )
//=> Route.Settings({ rest: '1/2/3' })

const renderRoute = () => {
    const url = window.location.pathname

    React.render( 
        view( Route.matchOr( () => Route.of.Home(), url ) )
        , document.body 
    )
}

// Respond to history
history.onpopstate( () => renderRoute() )

// Render initial route
renderRoute()
```

What?
=====

- Data Driven
- Pure
- Predictable
- Simple
- Composeable
- Server + Client
- Serializable

#### Predictable

In the land of SPA's, routing bugs are probably the most frustrating to debug, because you are often losing context as the page switches.

The standard approach to routing is to generate a regex and pick the first match that works.

What this library does differently is handle the logic of routing with a parser that can justify and rank its decisions which can lead to 
better matches that don't rely on definition order.

E.g. the following patterns can match the same URL, but one is more specific.

| Type          | Pattern                 | 
|---------------|-------------------------|
| Less Specific | `/accounts/:account_id` |
| More Specific | `/accounts/create`     |

If we had a url `/accounts/create` both patterns will match, but clearly a particular pattern is the intended match.  Most routers rely on definition order but this library will rank matches by specificity and return the best match.

You can then take that stream of known structures and very easily connect it to the history API or server side routing.  It's exactly the kind of thing you don't realise you need until you do.

#### Data Driven

This library uses a specification for it's data structures called [static-sum-type](https://gitlab.com/JAForbes/static-sum-type).  You can take the output and generate your own framework or application behaviour in a standard structured way.  You can also persist / serialize and transfer these data structures because reference equality is never relied upon.

This means you can too fun things like have your API define its endpoints with superouter and then send type information over the wire to generate constructors for a client side SDK for better validation.

Or you can store route information as analytics and replay them later without losing accompanying state in the deserialization process.

Routes are the heart of our applications but by compressing them into strings and regular expressions we are throwing away valuable information that can be used in various parts of the application.

#### Pure

This library exposes pure functions, it's up to you to connect the routing data structures to your own framework or native browser API.  That at first may sound like a chore, but it's exactly what you need when you decide you want to do some fancy hydration, ssr or custom routing transitions.

When a library manages the routing side effects, you may find yourself hacking around the edges to do the thing you actually want to do.

#### Simple

All this library does is handle conversions between different types of data, it doesn't perform any side effects directly so it's easy to explore and test and therefore reliable to build upon.

#### Composeable

Because the data structures used by this library are part of the exposed API, you can compose this library's functions with your own to create something new and interesting without having to submit a PR.

API
===

### `superouter.type`

`superouter.type({ [caseName]: patternString })`

Defines a `Route` type for your application.

```js

const Route = 
    superouter.type({
        Home: '/',
        Settings: '/settings/:page',
        Messages: '/messages/:user/:thread'
    })
```

The `patternString` can include the following forms.

| Type     | Format    | Explanation                                |
|----------|-----------|--------------------------------------------|
| Path     | `text`    | A static segment of a route path.          |
| Part     | `:text`   | A dynamic segment of a route path          |
| Variadic | `...text` | 1 or more dyanmic segments of a route path |

`patternString` types can not be mixed.  So `:...text` is not valid.

---

### `Route`

`Route` is a type that represents the various pages in your application.

You can create more than 1 `Route` type for different sections or layers of your app.  You can define all your Routes centrally or cascade your `Route` matching in layers in a typed manner.

The `Route` type will have a constructor function for each case of `Route` you specified in it's definition under the namespace `of`.  These `Route` constructor functions will `throw` if a property specified in the pattern was not passed in at initilization.

To safely create a `Route` instance from a `url`, use `Route.matchOr`.

```js

const Route =
    superouter.type('Route', {
        Home: '/',
        Settings: '/settings/:section/:setting'
    })

Route.of.Settings({ section: 'ci', settings: 'access' })
// Route.of.Settings({ section: 'ci', settings: 'access' })

Route.of.Settings({ missing: 1, things: 2 })
//=> TypeError: ...
```

#### `Route.fold` 

`({ [routeCaseNames]: ({ ...routeArgs }) => a }) => Route => a`

```jsx
const view = 
    Route.fold({
        Home: () => <Home/>,
        Post: ({ name }) => <Post postName={name} />
    })

view ( Route.of.Post({ name: 'A Perfect API' }) )
// => <Post postname="A Perfect API"/>
```

Used to define functions that handle all the potential routes in your application.  

For some more advanced error checking try [static-sum-type](https://gitlab.com/JAForbes/static-sum-type/tree/master/modules/fold#fold)'s fold instead.

`static-sum-type` will throw if you have missed cases or specified too many cases.

`Route.fold` is especially useful to map `Route` to views in your application in a manner similar to `<Switch>` in `react-router`.

#### `Route.matchOr` 

`( (Error[]) => Route, url ) => Route`

`matchOr` accepts a callback to handle url's that can't be matched and a `url` to try to match.

If no match can be found the callback is executed to allow the user to return from unexpected url's.

```js
const Route = type('Route', {
    Home: '/',
    Settings: '/settings/:settings',
    Album: '/album/:album_id',
    AlbumPhoto: '/album/:album_id/photo/:file_id',
    Tag: '/tag/:tag',
    TagList: '/tag',
    TagFile: '/tag/:tag/photo/:file_id'
})

Route.matchOr( 
    () => Route.of.Home(),
    '/album/abc123/photo/123'
)
//=> Route.of.AlbumPhoto({ album_id: 'abc123', file_id: '123' })


Route.matchOr( 
    () => Route.of.Home(),
    '/unknown/route'
)
//=> Route.of.Home()
```

`matchOr` also passes in all the errors keyed by the case name of the routes
to the callback, so you can have custom logic that returns different default branches depending on the matching errors.

```js
Route.matchOr(
    errs => errs.TagFile.find( x => x.case === 'ExcessPattern' )
        ? Route.TagList()
        : Route.Home()
    , url
)
```

### `Route.matches`

`string => Valid.Y( Route[] ) | Valid.N ( StrMap( CaseName, Error[] ) )`

`Route.matches` is a lower level alternative to `Route.matchOr` which either returns all the valid matching routes (if there are any) or all the errors
that prevented matches keyed by the name of the route cases.

### `Route.toURL`

`Route => string`

```js
const Route = type('Route', {
    Home: '/',
    Settings: '/settings/:settings',
    Album: '/album/:album_id',
    AlbumPhoto: '/album/:album_id/photo/:file_id',
    Tag: '/tag/:tag',
    TagFile: '/tag/:tag/photo/:file_id'
})

Route.toURL( Route.Tag({ tag: 'beach' }) )
//=> /tag/beach
```

### Advanced

#### `tokenizePattern`

#### `tokenizeURL`

#### `PatternToken`

#### `URLToken`

#### `Valid`

This library uses a sum-type `Valid` to safely model invalid route matches.  The user friendly API traverses this type and throws on errors.  But if one 
wants to safely analyze all the invalid patterns without using a `try {} catch(e){...}` `Valid` can be extremely useful.

You'll encounter `Valid` if you interact with some more advanced functions exposed by the library including `tokenizePattern`, `tokenizeURL`, `type$safe`, or `Route.matches`.

#### Error Types

| Type         | Case          | When 
|--------------|---------------|------
| `PatternToken` | `DuplicateDef`  | When two patterns in a route defintion are effectively the same.
| `PatternToken` | `DuplicatePart` | When two bindings within a pattern have the same name. 
| `PatternToken` | `VariadicPosition` | When a variadic pattern is not in the final position. 
| `PatternToken` | `VariadicCount` | When there is more than one variadic in a pattern.
| `URLToken` | `UnmatchedPaths` | When a path segment was found but it did not match the expected value.
| `URLToken` | `ExcessSegment` | When a URL had more segments than a pattern had expected and there was no variadic to consume the excess segments.
| `URLToken` | `ExcessPattern` | When a URL did not have enough segments to satisfy a pattern.
