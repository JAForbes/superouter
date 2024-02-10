/* eslint-disable @typescript-eslint/no-explicit-any */

import { Either } from "./either.js"
import * as ParsePath from "./parsePath.js"

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
    toPath( instance: Instance<N, D, keyof D> ): string
    toPathSafe( instance: Instance<N, D, keyof D> ): Either<Error, string>
    parsePath( url: string ): Instance<N, D, keyof D>
    parsePathSafe( url: string ): Either<Error, Instance<N, D, keyof D>>
    match: <T>(instance: Instance<N, D, keyof D>, options: MatchOptions<D,T> ) => T
}

export type Is<R extends string> = `is${R}`

export type Get<R extends string> = `get${R}`


export type Instance<N extends string, D extends Definition, K extends keyof D> = ReturnType<Constructors<N,D>[K]>

export type Superoute<N extends string, D extends Definition> = Constructors<N,D> & API<N,D> & RouteIs<N,D> & RouteGet<N,D>


export type RouteIs<N extends string, D extends Definition> = {
    [Key in keyof D as Is<Key extends string ? Key : never>]: (route: Instance<N, D, keyof D>) => boolean
}

export type RouteGet<N extends string, D extends Definition> = {
    [Key in keyof D as Get<Key extends string ? Key : never>]: <T>(fallback:T, visitor: (value: Value<D[Key]>) => T, route: Instance<N, D, keyof D>) => boolean
}

function match(instance: any, options: any): any {
    return options[instance.tag](instance.value)
}

export function type<N extends string, D extends Definition>(type: N, routes: D): Superoute<N,D> {
    function toPathSafe(route: any): Either<Error, string> {
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
    
    function toPath(route: any){
        const result = toPathSafe(route)
        if (result.tag === 'Left') {
            throw result.value
        } else {
            return result.value
        }
    }

    function parsePathSafe( url: string ): Either<Error, any> {
        let bestRank = 0;
        let bestRoute: any = null;
        let error: any = null;
        for (const [tag, patterns] of Object.keys(api.patterns as string[])) {
            for( const pattern of patterns) {
                const result = ParsePath.safe(url,pattern)
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

    function parsePath(route: any): any {
        const res = parsePathSafe(route)
        if (res.tag == 'Left') {
            throw res.value
        }
    }

    const api: any = {
        patterns: {},
        definition: routes,
        toPath,
        toPathSafe,
        parsePath,
        parsePathSafe,
        match
    }

    for( const [tag, of] of Object.entries(routes) ) {
        api[tag] = (value={}) => ({ type, tag, value })

        const res = of({})

        let patterns : string[] = [];
        if (typeof res === 'string') {
            patterns = [res]
        } else if ( Array.isArray(res) ) {
            if ( Array.isArray(res[1]) ) {
                patterns = res[1]
            } else {
                patterns = res
            }
        }
        if (patterns.length == 0) {
            throw new Error(`Must provide at least path pattern for ${type}.${tag}`)
        }
        
        api.patterns[tag] = patterns
        api[`is${tag}`] = (v:any) => v.tag === tag
        api[`get${tag}`] = (fallback:any, f:any, v:any) => v.tag === tag ? f(v.value) : fallback
    }
    return api as any as Superoute<N,D>
}

export type Value< I extends (v:any) => any> = Parameters<I>[0]

