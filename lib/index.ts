/* eslint-disable @typescript-eslint/no-explicit-any */

export type Either<L, R> = 
    | { type: 'Either', tag: 'Left', value: L } 
    | { type: 'Either', tag: 'Right', value: R }

const Either = {
    Left<L,R>(value: L): Either<L,R>{
        return { type: 'Either', tag: 'Left', value }
    },
    Right<L,R>(value: R): Either<L, R>{
        return { type: 'Either', tag: 'Right', value }
    }
}

type Patterns = string | string[]
type DefinitionResponse = [any,Patterns] | Patterns
type Definition = Record<string, (v: any) => DefinitionResponse>
type Constructors<N extends string, D extends Definition> = {
    [R in keyof D]: {
        (value: Parameters<D[R]>[0]): { type: N, tag: R, value: Parameters<D[R]>[0] }
    }
}
type MatchOptions<N extends string, D extends Definition, T> = {
    [R in keyof D]: {
        (value: Parameters<D[R]>[0]): T
    }
}
type API<N extends string, D extends Definition> = {
    definition: { [R in keyof D]: D[R] }
    patterns: { [R in keyof D]: string[] }
    toURL( instance: Instance<N, D, keyof D> ): string
    toURLSafe( instance: Instance<N, D, keyof D> ): Either<Error, string>
    parseURL( url: string ): Instance<N, D, keyof D>
    parseURLSafe( url: string ): Either<Error, Instance<N, D, keyof D>>
    match: <T>( options: MatchOptions<N,D,T> ) => (instance: Instance<N, D, keyof D> ) => T
}

type Is<R extends string> = `is${R}`


type Instance<N extends string, D extends Definition, K extends keyof D> = ReturnType<Constructors<N,D>[K]>

type Superoute<N extends string, D extends Definition> = Constructors<N,D> & API<N,D> & RouteIs<N,D>


type RouteIs<N extends string, D extends Definition> = {
    [Key in keyof D as Is<Key extends string ? Key : never>]: (route: Instance<N, D, keyof D>) => boolean
}

function doesPathMatchPattern(path: string, pattern: string) : boolean {
    let done = false
    let i = 0;

    type Mode = 'investigating'| 'expecting-literal' | 'expecting-variable' | 'accepting-remainder';
    let mode: Mode;
    
    // parse the first segment of the pattern until we hit a `/` or the end of the string
    // if it a literal, change mode to expecting literal, and start iterating through path, if any character doesn't match, exit early (false)
    // if everything matches, and you reach a `/` start the same process again
    // if the next segment is a variable, just store all the characters until you hit the next segment
    // if you reach the end of the path | pattern without failing on a literal, its a match
    // we could optionally return a score (number of matches weighted to longer/more complex strings?) but we can know the complexity at definition time
    // so if its a match the complexity should be that const number.
    
    let patternIndex = 0;
    let pathIndex = 0;
    mode = 'investigating'

    // we add an extra terminator so every if/else
    // only checks for that delimiter, instead of the delimiter + end of string
    path = path + '/'
    pattern = pattern + '/'

    let vars : Record<string,string> = {}
    while ( !done ) {
        
        if (mode != 'accepting-remainder' && (path[pathIndex] == null || pattern[patternIndex] == null)) {
            // todo-james return what was expected
            return false;
        }

        // just skips repeated forward slashes
        // we treat /a/b/////c as the same as /a/b/c as its usually a bug
        // in the users code or a user doing something strange
        let wasNewPatternSegment = false;
        let wasNewPathSegment = false;
        while (pattern[patternIndex] === '/') {
            wasNewPatternSegment = true;
            patternIndex++
        }

        while (path[pathIndex] === '/') {
            wasNewPathSegment = true;
            pathIndex++
        }

        switch (mode) {
            case 'investigating': {

                if ( wasNewPatternSegment && pattern[patternIndex] == ':') {
                    mode = 'expecting-variable'
                } else if ( wasNewPatternSegment ) {
                    mode = 'expecting-literal'
                } else if 
                mode = 'accepting-remainder'
                console.log('hi')
                break;
            }
            case 'expecting-variable': {
                let varName = ''
                let varValue = ''
                while (pattern[patternIndex] !== '/') {
                    patternIndex++
                    varName += pattern[patternIndex]
                }
                while (path[pathIndex] !== '/') {
                    pathIndex++
                    varValue += path[pathIndex]
                }
                vars[varName] = varValue
            }
            case 'expecting-literal': {
                let literalExpected = ''
                let literalFound = ''
                while (pattern[patternIndex] !== '/') {
                    patternIndex++
                    varName += pattern[patternIndex]
                }
                while (path[pathIndex] !== '/') {
                    pathIndex++
                    varValue += path[pathIndex]
                }
                vars[varName] = varValue
            }
            case 'parsing-pattern-segment': {

                console.log('2')
            }
            break;
        }
        pattern[i]
    }
}

export function parseURLSafe<N extends string, D extends Definition, K extends keyof D>( type: API<N, D>, url: string ): Either<Error, Instance<N, D, K>> {

    let winner : K | null = null;
    for( let x of Object.entries(type.regex) ) {
        x
    }
    return Either.Left( new Error('Hello'))
}

export function type<N extends string, D extends Definition>(type: N, routes: D): Superoute<N,D> {
    const api: any = {
        patterns: {},
        regex: {}
    }
    for( const [tag, of] of Object.entries(routes) ) {
        api[tag] = (value={}) => ({ type, tag, value })

        const [_, pattern] = of({})
        api.patterns[tag] = pattern
        api.regex[tag] = re.pathToRegexp(pattern)
        api.complexity[tag] = pattern.split('/').map( x => x.startsWith(':') ? 2 : 1 )
    }
    return null as any as Superoute<N,D>
}

type Value< I extends (v:any) => any> = Parameters<I>[0]


const Example = type('Example', {
    Welcome: (_: { name?: string }) => [`/welcome/:name`, `/welcome`],
    Login: (_: { error?: string }) => [`/login/error/:error`, `/login`]
})

type Example = typeof Example["definition"]


// Rough type definition of mithril component
type Component<T> = (v: { attrs: T}) => ({ view: (v: { attrs: T }) => any })

const WelcomeComp: Component< Value<Example["Welcome"]> > = () => ({ view: (v) => `Welcome ${v.attrs.name ?? 'User'}`})
const LoginComp: Component< Value<Example["Login"]> > = () => ({ view: (v) => [
    v.attrs.error ? 'There was an error: ' + v.attrs.error : null,
    'Please login using your username and password.'
]})

type Components<D extends Definition> = {
    [K in keyof D]: Component< Parameters<D[K]>[0] >
}

const Components : Components<Example> = {
    Welcome: WelcomeComp,
    Login: LoginComp
}

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
