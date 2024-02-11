/* eslint-disable @typescript-eslint/no-explicit-any */

import { Either } from "./either.js";
import * as ParsePath from "./fromPath.js";

export type Patterns = string | string[];

export type DefinitionResponse = [any, Patterns] | Patterns;
export type Definition = Record<string, (v: any) => DefinitionResponse>;
export type Constructors<N extends string, D extends Definition> = {
  [R in keyof D]: {
    (value: (Parameters<D[R]>[0] & { rest?: string } )): {
      type: N;
      tag: R;
      value: Parameters<D[R]>[0];
    };
  };
};
export type MatchOptions<D extends Definition, T> = {
  [R in keyof D]: {
    (value: Parameters<D[R]>[0]): T;
  };
};
export type API<N extends string, D extends Definition> = {
  type: N,
  definition: { [R in keyof D]: D[R] };
  patterns: { [R in keyof D]: string[] };
  toPath(instance: InternalInstance<N, D, keyof D>): string;
  toPathSafe(instance: InternalInstance<N, D, keyof D>): Either<Error, string>;
  fromPath(path: string): InternalInstance<N, D, keyof D>;
  fromPathSafe(path: string): Either<Error, InternalInstance<N, D, keyof D>>;
  matchOr(fallback: () => InternalInstance<N, D, keyof D>, path: string): InternalInstance<N, D, keyof D>;
  match: <T>(
    instance: InternalInstance<N, D, keyof D>,
    options: MatchOptions<D, T>
  ) => T;
};

export type Is<R extends string> = `is${R}`;

export type Get<R extends string> = `get${R}`;

type Otherwise<D extends Definition> = {
    otherwise: <T, R extends Partial<keyof D>>(tags: R[]) => (fn: () => T) => {
        [k in R]: () => T
    }
}

type InternalInstance<
  N extends string,
  D extends Definition,
  K extends keyof D
> = ReturnType<Constructors<N, D>[K]>;

export type Instance<A extends API<any, any> > = InternalInstance<A["type"], A["definition"], keyof A["definition"]>

export type Superoute<N extends string, D extends Definition> = Constructors<
  N,
  D
> &
  API<N, D> &
  RouteIs<N, D> &
  RouteGet<N, D> & 
  Otherwise<D>;

export type RouteIs<N extends string, D extends Definition> = {
  [Key in keyof D as Is<Key extends string ? Key : never>]: (
    route: InternalInstance<N, D, keyof D>
  ) => boolean;
};

export type RouteGet<N extends string, D extends Definition> = {
  [Key in keyof D as Get<Key extends string ? Key : never>]: <T>(
    fallback: T,
    visitor: (value: InternalValue<D[Key]>) => T,
    route: InternalInstance<N, D, keyof D>
  ) => boolean;
};

function match(instance: any, options: any): any {
  return options[instance.tag](instance.value);
}

function otherwise(tags:string[]) {
    return (fn: any) => 
        Object.fromEntries(
            tags.map( tag => [tag, fn] )
        )
}


export function type<N extends string, D extends Definition>(
  type: N,
  routes: D
): Superoute<N, D> {
  function toPathSafe(route: any): Either<Error, string> {
    const errors = [];
    const paths = [];
    const ranks: Record<string, number> = {};
    let bestPath: string[] | null = null;
    let bestRank = 0;
    let error: string | null = null;
    for (const pattern of api.patterns[route.tag]) {
      let path: string[] | null = [];
      let rank = 0;
      for (const segment of pattern.split("/")) {
        if (segment.startsWith(":")) {
          const name = segment.slice(1);
          if (route.value[name]) {
            path.push(route.value[name]);
            rank += 2;
          } else {
            error = `Could not build pattern ${pattern} from value ${JSON.stringify(
              route.value
            )} as '${name} was empty'`;
            errors.push(error);
            path = null
            break;
          }
        } else {
          path.push(segment)
          rank += 4;
        }
      }
      if (path != null) {
        paths.push(path);
        ranks[pattern] = rank;
        if (rank > bestRank || bestPath == null) {
          bestRank = rank;
          bestPath = path;
        }
        continue;
      }
    }

    if (bestPath) {
      return { type: "Either", tag: "Right", value: bestPath.join("/") };
    } else if (errors.length) {
      return { type: "Either", tag: "Left", value: new Error(errors[0]) };
    } else {
      throw new Error(`Unexpected failure converting route ${route} to url`);
    }
  }

  function toPath(route: any) {
    const result = toPathSafe(route);
    if (result.tag === "Left") {
      throw result.value;
    } else {
      return result.value;
    }
  }

  function matchOr(otherwise: () => any, path: string): any {
    const res = fromPathSafe(path)
    if (res.tag == 'Left') {
      return otherwise()
    } else {
      return res.value
    }
  }

  function fromPathSafe(path: string): Either<Error, any> {

    if (path.includes('://')) {
      return Either.Left(new Error(`Please provide a path segment instead of a complete url found:'${path}'`))
    }
    
    let bestRank = 0;
    let bestRoute: any = null;
    let error: any = null;
    for (const [tag, patterns] of Object.entries(api.patterns as Record<string, string[]>) ) {
      for (const pattern of patterns) {
        const result = ParsePath.safe(path, pattern);
        if (result.tag === "Left") {
          if (error == null) {
            error = result;
          }
        } else {
          if (bestRoute == null || result.value.score > bestRank) {
            bestRoute = { type, tag, value: { ...result.value.value, rest: result.value.rest } };
            bestRank = result.value.score;
          }
        }
      }
    }

    if (bestRoute == null) {
      if (error) {
        return error;
      } else {
        return {
          type: "Either",
          tag: "Left",
          value: new Error(
            `Could not parse url ${path} into any pattern on type ${type}`
          ),
        };
      }
    } else {
      return {
        type: "Either",
        tag: "Right",
        value: bestRoute,
      };
    }
  }

  function fromPath(route: any): any {
    const res = fromPathSafe(route);
    if (res.tag == "Left") {
      throw res.value;
    } else {
        return res.value
    }
  }

  const api: any = {
    type,
    patterns: {},
    definition: routes,
    toPath,
    toPathSafe,
    fromPath,
    fromPathSafe,
    matchOr,
    match,
    otherwise
  };

  for (const [tag, of] of Object.entries(routes)) {
    api[tag] = (value:any = {}) => {
        if ( !value.rest ) {
            value.rest = '/'
        }
        return { type, tag, value }
    };

    const res = of({});

    let patterns: string[] = [];
    if (typeof res === "string") {
      patterns = [res];
    } else if (Array.isArray(res)) {
      if (Array.isArray(res[1])) {
        patterns = res[1];
      } else {
        patterns = res;
      }
    }
    if (patterns.length == 0) {
      throw new Error(`Must provide at least path pattern for ${type}.${tag}`);
    }

    api.patterns[tag] = patterns;
    api[`is${tag}`] = (v: any) => v.tag === tag;
    api[`get${tag}`] = (fallback: any, f: any, v: any) =>
      v.tag === tag ? f(v.value) : fallback;
  }
  return api as any as Superoute<N, D>;
}

type InternalValue<I extends (v: any) => any> = Parameters<I>[0];

export type Value<A> = 
    A extends API<any,any>
        ? Instance<A>["value"]
    : A extends Instance<any>
      ? A["value"]
      : never

export type Tag<A> =
    A extends API<any,any>
    ? Instance<A>["tag"]
    : A extends Instance<any>
    ? A["tag"]
    : never
