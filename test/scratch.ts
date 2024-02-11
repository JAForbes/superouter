/* eslint-disable @typescript-eslint/no-explicit-any */
import * as superouter from '../lib/index.js'

const Example = superouter.type('Example', {
    Welcome: (_: { name?: string }) => [`/welcome/:name`, `/welcome`],
    Login: (_: { error?: string }) => [`/login/error/:error`, `/login`]
})

type Example = typeof Example["definition"]


// Rough type definition of mithril component
type Component<T> = (v: { attrs: T}) => ({ view: (v: { attrs: T }) => any })
const welcome = Example.Welcome({ name: 'cool' })
const login = Example.Login({})
const WelcomeComp: Component<superouter.Value<typeof welcome> > = () => ({ view: (v) => `Welcome ${v.attrs.name ?? 'User'}`})
const LoginComp: Component<superouter.Value<typeof login> > = () => ({ view: (v) => [
    v.attrs.error ? 'There was an error: ' + v.attrs.error : null,
    'Please login using your username and password.'
]})

type Components<D extends superouter.Definition> = {
    [K in keyof D]: Component< Parameters<D[K]>[0] >
}

const Components : Components<Example> = {
    Welcome: WelcomeComp,
    Login: LoginComp
}

let m: any;
m.route(
    document.body
    ,'/'
    , Object.fromEntries(Object.entries(Example.patterns).flatMap( ([k,v]) => v.map( v2 => [v2, k]) )) 
)

// const AComp : Component<typeof Example.A> = () => ({ view: () => null })


// const Component : Components<Example["definition"]> = {
//     A: Comp
// }

// const a = Example.A({ a_id: 'hello' })

// const fn = Example.match({
//     A: ({a_id}) => 1,
//     B: ({ b_id }) => 2
// })
