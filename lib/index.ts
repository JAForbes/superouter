/* eslint-disable @typescript-eslint/no-explicit-any */

import { safe } from "./match.js"

export type Either<L, R> = 
    | { type: 'Either', tag: 'Left', value: L } 
    | { type: 'Either', tag: 'Right', value: R }

export const Either = {
    Left<L,R>(value: L): Either<L,R>{
        return { type: 'Either', tag: 'Left', value }
    },
    Right<L,R>(value: R): Either<L, R>{
        return { type: 'Either', tag: 'Right', value }
    }
}

export type Patterns = string | string[]
export type DefinitionResponse = [any,Patterns] | Patterns
export type Definition = Record<string, (v: any) => DefinitionResponse>
export type Constructors<N extends string, D extends Definition> = {
    [R in keyof D]: {
        (value: Parameters<D[R]>[0]): { type: N, tag: R, value: Parameters<D[R]>[0] }
    }
}
export type MatchOptions<D extends Definition, T> = {
    [R in keyof D]: {
        (value: Parameters<D[R]>[0]): T
    }
}
export type API<N extends string, D extends Definition> = {
    definition: { [R in keyof D]: D[R] }
    patterns: { [R in keyof D]: string[] }
    toUrl( instance: Instance<N, D, keyof D> ): string
    toUrlSafe( instance: Instance<N, D, keyof D> ): Either<Error, string>
    parseUrl( url: string ): Instance<N, D, keyof D>
    parseUrlSafe( url: string ): Either<Error, Instance<N, D, keyof D>>
    match: <T>(instance: Instance<N, D, keyof D>, options: MatchOptions<D,T> ) => T
}

export type Is<R extends string> = `is${R}`


export type Instance<N extends string, D extends Definition, K extends keyof D> = ReturnType<Constructors<N,D>[K]>

export type Superoute<N extends string, D extends Definition> = Constructors<N,D> & API<N,D> & RouteIs<N,D>


export type RouteIs<N extends string, D extends Definition> = {
    [Key in keyof D as Is<Key extends string ? Key : never>]: (route: Instance<N, D, keyof D>) => boolean
}

function match(instance: any, options: any): any {
    return options[instance.tag](instance.value)
}

export function type<N extends string, D extends Definition>(type: N, routes: D): Superoute<N,D> {
    function toUrlSafe(route: any): Either<Error, string> {
        const errors = []
        const paths = []
        const ranks: Record<string, number> = {}
        let bestPath : string[] | null = null;
        let bestRank =  0;
        let error : string | null = null
        for(const pattern of api.patterns[route.tag]) {

            const path: string[] = []
            let rank = 0
            for( const segment of pattern.split('/') ) {
                if (segment.startsWith(':')){
                    const name = segment.slice(1)
                    if (name in route.value) {
                        path.push(route.value)
                        rank += 2
                    } else {
                        error = `Could not build pattern ${pattern} from value ${JSON.stringify(route.value)} as '${name} was undefined'`
                        errors.push(error)
                        break
                    }
                } else {
                    rank += 4
                }
            }
            if (path != null) {
                paths.push(path)
                ranks[pattern] = rank
                if ( rank > bestRank || bestPath == null ) {
                    bestRank = rank
                    bestPath = path
                }
                continue;
            }
        }

        if (bestPath) {
            return { type: 'Either', tag: 'Right', value: bestPath.join('/') }
        } else if (errors.length) {
            return { type: 'Either', tag: 'Left', value: new Error(errors[0])}
        } else {
            throw new Error(`Unexpected failure converting route ${route} to url`)
        }
    }
    
    function toURL(route: any){
        const result = toUrlSafe(route)
        if (result.tag === 'Left') {
            throw result.value
        } else {
            return result.value
        }
    }

    function parseUrlSafe( url: string ): Either<Error, any> {
        let bestRank = 0;
        let bestRoute: any = null;
        let error: any = null;
        for (const [tag, patterns] of Object.keys(api.patterns as string[])) {
            for( const pattern of patterns) {
                const result = safe(url,pattern)
                if (result.tag === 'Left') {
                    if ( error == null ) {
                        error = result
                    }
                } else {
                    if (bestRoute == null || result.value.score > bestRank) {
                        bestRoute = { type, tag, value: result.value }
                        bestRank = result.value.score
                    }
                }
            }
        }
        
        if ( bestRoute == null ) {
            if ( error ) {
                return error
            } else {
                return { 
                    type: 'Either', 
                    tag: 'Left', 
                    value: new Error(
                        `Could not parse url ${url} into any pattern on type ${type}` 
                    )
                }
            }
        } else {
            return {
                type: 'Either',
                tag: 'Right',
                value: bestRoute
            }
        }
    }

    function parseUrl(route: any): any {
        const res = parseUrlSafe(route)
        if (res.tag == 'Left') {
            throw res.value
        }
    }

    const api: any = {
        patterns: {},
        definition: routes,
        toURL,
        toUrlSafe,
        parseUrl,
        parseUrlSafe,
        match
    }
    for( const [tag, of] of Object.entries(routes) ) {
        api[tag] = (value={}) => ({ type, tag, value })

        const [_, pattern] = of({})
        api.patterns[tag] = ([] as string[]).concat(pattern)
    }
    return api as any as Superoute<N,D>
}

export type Value< I extends (v:any) => any> = Parameters<I>[0]

