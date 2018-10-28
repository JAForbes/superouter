superouter
----------

Warning: These docs do not match reality yet.
==============================================

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

Route.Home() 
//=> { type: 'Route', case: 'Home' }
Route.Post({ post }) 
//=> { type: 'Route', case: 'Post', value: { post }}
Route.Settings({ rest: '/a/b/c })
// => { type: 'Route', case: 'Settings', value: 'rest' }

const view = 
    Route.fold(
        { Home: () => <Home/>
        , Post: ({ post }) => <Post post={post} />
        , Settings: ({ rest }) => <Settings subpath={rest} />
        }
    )

view ( Route.Home() ) //=> <Home />

Route.matchOr( Route.Home(), '/settings/1/2/3' )
//=> Route.Settings({ rest: '1/2/3' })

Route.match( '/settings/1/2/3' )
//=> Valid.Y( Route.Settings({ rest: '1/2/3' }) )

Route.match( '/posts/how-to-read/extra/segments' )
//=> Valid.N([ new Error("Excess route segment ...") ])

const renderRoute = () => {
    const url = window.location.pathname

    React.render( 
        view( Route.matchOr( Route.Home(), url ) )
        , document.body 
    )
}

history.onpopstate( () => renderRoute() )
renderRoute()
```

What?
=====

- Data Driven
- Pure
- Predictable
- Simple
- Composeable

#### Predictable

In the land of SPA's, routing bugs are probably the most frustrating to debug, because you are often losing context as the page switches.

The standard approach to routing is to generate a regex and pick the first match that works.

What this library does differently is handle the logic of routing with a parser that can be stepped through which then emits a known domain of standard structures that explains the decisions it made and why there may have been an error.

You can then take that stream of known structures and very easily connect it to the history API or even server side routing.  It's exactly the kind of thing you don't realise you need until you do.


#### Data Driven

This library uses a specification for it's data structures called [static-sum-type](https://gitlab.com/JAForbes/static-sum-type).  You can take the output and generate your own framework or application behaviour in a standard structured way.  You can also persist / serialize and transfer these data structures because reference equality is never relied upon.

#### Pure

This library exposes pure functions, it's up to you to connect the routing data structures to your own framework or native browser API.  That at first may sound like a chore, but it's exactly what you need when you decide you want to do some fancy hydration, ssr or custom routing transitions.

When a library manages the routing side effects, you may find yourself hacking around the edges to do the thing you actually want to do.

#### Simple

All this library does is handle converting a string into an array of tokens, and vice versa.  It's easy to grok, and simple to extend.

#### Composeable

Because the data structures used by this library are part of the exposed API, you can compose this libraries functions with your own to create something new and interesting without having to submit a PR.

API
===

### `superouter.type({ [caseName]: patternString })`

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


### `Route`

`Route` is a type that represents the various pages in your application.

You can create more than 1 `Route` type for different sections or layers of your app.  You can define all your Routes centrally or cascade your `Route` matching in layers in a typed manner.

The `Route` type will have a constructor function for each case of `Route` you specified in it's definition.  These `Route` constructor functions will `throw` if a property specified in the pattern was not passed in at initilization.

To safely create a `Route` instance from a `url`, use `Route.matchOr`.

#### Route.fold 

`({ [routeCaseNames]: ({ ...routeArgs }) => a }) => Route => a`

```jsx
const view = 
    Route.fold({
        Home: () => <Home/>,
        Post: ({ name }) => <Post postName={name} />
    })

view ( Route.Post({ name: 'A Perfect API' }) )
// => <Post postname="A Perfect API"/>
```

Used to define functions that handle all the potential routes in your application.  This function will throw if you have missed cases, specified too many cases and other error checks.

`Route.fold` is especially useful to map `Route` to views in your application.

#### Route.matchOr 

`( (Error[]) => Route, url ) => Route`

### Route.match

`string => Valid.Y( Route ) | Valid.N ( Error[] )`

### Route.toURL

`Route => string`

### superouter.tokenizePattern

### superouter.tokenizeURL

FAQ
===

#### Why does this library support `Variadic` routes?

I don't know.  I'll probably remove it.
