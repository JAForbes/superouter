/* eslint-disable @typescript-eslint/no-explicit-any */

import { Either } from "./either.js";
import * as ParsePath from "./fromPath.js";
import { normalizePathSegment, normalizeRest } from "./normalize.js";

export type Patterns = string | string[];

export type DefinitionResponse = [any, Patterns] | Patterns;
export type DefinitionValue =
  | ((v: any) => DefinitionResponse)
  | DefinitionResponse;

export type Definition = Record<string, DefinitionValue>;
export type ValueFromDefinitionValue<V, PV> = V extends DefinitionValue
  ? V extends (v: any) => DefinitionResponse
    ? PV extends null
      ? Parameters<V>[0]
      : Parameters<V>[0] & PV
    : PV extends null
    ? Record<string, any>
    : PV
  : never;

export type Constructors<N extends string, D extends Definition, PV> = {
  [R in keyof D]: {
    (value: ValueFromDefinitionValue<D[R], PV>, config?: { rest?: string }): {
      type: N;
      tag: R;
      context: RouteContext;
      value: ValueFromDefinitionValue<D[R], PV>;
    };
  } & {
    create<D2 extends Definition>(
      childDefinition: D2
    ): Superoute<
      R extends string ? `${N}.${R}` : string,
      D2,
      ValueFromDefinitionValue<D[R], PV>
    >;
    ['superouter/metadata']: { value: ValueFromDefinitionValue<D[R], PV>, tag: R }
  };
};

export type MatchOptions<D extends Definition, T, PV> = {
  [R in keyof D]: {
    (value: ValueFromDefinitionValue<D[R], PV>): T;
  };
};

// The route context is where we store metadata we need to recreate a URL that
// is not part of the typed value set.
//
// Currently we only use the rest excess unparsed url fragments, but we may
// add more metadata in the future.
export type RouteContext = {
  rest: string;
  patterns: string[]
  parentPatterns: string[]
};

export type API<N extends string, D extends Definition, PV> = {
  type: N;
  definition: { [R in keyof D]: D[R] };
  patterns: { [R in keyof D]: string[] };
  toPath(instance: InternalInstance<N, D, keyof D, PV>): string;
  toPathSafe(instance: InternalInstance<N, D, keyof D, PV>): Either<Error, string>;
  toLocalPath(instance: InternalInstance<N, D, keyof D, PV>): string;
  toPathSafe(
    instance: InternalInstance<N, D, keyof D, PV>
  ): Either<Error, string>;
  fromPath(path: string): InternalInstance<N, D, keyof D, PV>;
  fromPathSafe(path: string): Either<Error, InternalInstance<N, D, keyof D, PV>>;
  fromLocalPath(
    path: string,
    defaults: PV
  ): InternalInstance<N, D, keyof D, PV>;
  fromLocalPathSafe(
    path: string,
    defaults: PV
  ): Either<Error, InternalInstance<N, D, keyof D, PV>>;
  fromLocalPathOr(
    fallback: () => InternalInstance<N, D, keyof D, PV>,
    path: string,
    defaults: PV
  ): InternalInstance<N, D, keyof D, PV>;
  fromPathOr(
    fallback: () => InternalInstance<N, D, keyof D, PV>,
    path: string,
  ): InternalInstance<N, D, keyof D, PV>;
  match<T>(
    instance: InternalInstance<N, D, keyof D, PV>,
    options: MatchOptions<D, T, PV>
  ): T;
  match<T>(
    options: MatchOptions<D, T, PV>
  ): (instance: InternalInstance<N, D, keyof D, PV>) => T;
  def: <T>(
    fn: (x: InternalInstance<N, D, keyof D, PV>) => T
  ) => (x: InternalInstance<N, D, keyof D, PV>) => T;
  parentValue: PV;
};

export type Is<R extends string> = `is${R}`;

export type Get<R extends string> = `get${R}`;

type Otherwise<D extends Definition> = {
  otherwise: <R extends Partial<keyof D>>(
    tags: R[]
  ) => <T>(fn: () => T) => {
    [k in R]: () => T;
  };
};

type OtherwiseEmpty<D extends Definition> = {
  otherwise: () => <T>(fn: () => T) => {
    [k in keyof D]: () => T;
  };
};

type InternalInstance<
  N extends string,
  D extends Definition,
  K extends keyof D,
  PV
> = ReturnType<Constructors<N, D, PV>[K]>;

export type Instance<A extends API<any, any, any>> = InternalInstance<
  A["type"],
  A["definition"],
  keyof A["definition"],
  A["parentValue"]
>;

export type Superoute<
  N extends string,
  D extends Definition,
  PV
> = Constructors<N, D, PV> &
  API<N, D, PV> &
  RouteIs<N, D, PV> &
  RouteGet<N, D, PV> &
  Otherwise<D> &
  OtherwiseEmpty<D>;

export type RouteIs<N extends string, D extends Definition, PV> = {
  [Key in keyof D as Is<Key extends string ? Key : never>]: (
    route: InternalInstance<N, D, keyof D, PV>
  ) => boolean;
};

export type RouteGet<N extends string, D extends Definition, PV> = {
  [Key in keyof D as Get<Key extends string ? Key : never>]: <T>(
    fallback: T,
    visitor: (value: ValueFromDefinitionValue<D[Key], PV>) => T,
    route: InternalInstance<N, D, keyof D, PV>
  ) => T;
};

function match(...args: any[]): any {
  if (args.length == 2) {
    const [instance, options] = args
    return options[instance.tag](instance.value);
  } else if (args.length == 1) {
    const [ options ] = args
    return (instance: any) => {
      return options[instance.tag](instance.value);
    }
  } else {
    throw new Error('Expected either 2 or 1 parameters but received: ' + args.length)
  }
}

function def(fn: any): any {
  return (x: any) => fn(x);
}

function otherwise(tags: string[]) {
  return (fn: any) => Object.fromEntries(tags.map((tag) => [tag, fn]));
}

export type AnyRoute = { type: string, tag: string, value: Record<string, any>, context: RouteContext }

function toPathSafeExternal(route: AnyRoute): Either<Error, string>{
  return toPathInternalSafe(route, route.context.parentPatterns, route.context.patterns)
}

export { toPathSafeExternal as toPathSafe }

function toPathOrExternal(otherwise: string, route: AnyRoute): string {
  const answer = toPathInternalSafe(route, route.context.parentPatterns, route.context.patterns)
  if (answer.tag === 'Left') {
    return otherwise
  } else {
    return answer.value
  }
}

export { toPathOrExternal as toPathOr }

function toPathExternal(route: AnyRoute): string {
  const answer = toPathInternalSafe(route, route.context.parentPatterns, route.context.patterns)
  if (answer.tag === 'Left') {
    throw answer.value
  } else {
    return answer.value
  }
}

export { toPathExternal as toPath }


function toPathInternalSafe(
  route: any,
  parentPatterns: string[],
  localPatterns: string[]
): Either<Error, string> {
  const errors = [];
  const paths = [];
  const ranks: Record<string, number> = {};
  let bestPath: string[] | null = null;
  let bestRank = 0;
  let error: string | null = null;

  const pathPrefix = [];

  // generate path prefix first
  for (const parentPattern of parentPatterns) {
    for (const segment of parentPattern.split("/")) {
      if (segment.startsWith(":")) {
        const name = segment.slice(1);
        if (route.value[name]) {
          // intentional
          pathPrefix.push(route.value[name]);
        } else {
          error = `Could not build pattern ${parentPattern} from value ${JSON.stringify(
            route.value
          )} as '${name} was empty'`;
          errors.push(error);
          break;
        }
      } else {
        pathPrefix.push(segment);
      }
    }
  }

  for (const _pattern of localPatterns) {
    const pattern = normalizePathSegment(_pattern);
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
          path = null;
          break;
        }
      } else {
        path.push(segment);
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
    const value =
      (pathPrefix.length ? normalizePathSegment(pathPrefix.join("/")) : "") +
      normalizePathSegment(bestPath.concat(route.context.rest).join("/"));
    return { type: "Either", tag: "Right", value };
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

function toLocalPath(route: any) {
  const result = toPathInternalSafe(route, [], route.context.patterns);
  if (result.tag === "Left") {
    throw result.value;
  } else {
    return result.value;
  }
}

function toPathSafe(route: any): Either<Error, string> {
  const answer = toPathInternalSafe(route, route.context.parentPatterns, route.context.patterns);
  if (answer.tag === "Right") {
    return Either.Right(normalizePathSegment(answer.value));
  }
  return answer;
}


function internalCreate<
  N extends string,
  D extends Definition,
  C extends RouteContext
>(
  type: N,
  routes: D,
  routeContext: C,
  parentPatterns: string[]
): Superoute<N, D, null> {
  
  function fromLocalPathOr(
    otherwise: () => any,
    path: string,
    defaults: any
  ): any {
    const res = fromLocalPathSafe(path, defaults);
    if (res.tag == "Left") {
      return otherwise();
    } else {
      return res.value;
    }
  }

  function fromPathOr(otherwise: () => any, path: string): any {
    const res = fromLocalPathSafe(path, {});
    if (res.tag == "Left") {
      return otherwise();
    } else {
      return res.value;
    }
  }

  function fromPathSafe(path: string): Either<Error, any> {
    return fromPathSafeInternal(path, parentPatterns, api.patterns, {});
  }

  function fromPath(path: string): Either<Error, any> {
    const res = fromPathSafe(path);
    if (res.tag === "Left") {
      throw res.value;
    } else {
      return res.value;
    }
  }

  function fromLocalPathSafe(path: string, defaults: any): Either<Error, any> {
    return fromPathSafeInternal(path, [], api.patterns, defaults);
  }

  function fromPathSafeInternal(
    path: string,
    parentPatterns: string[],
    localPatterns: Record<string, string[]>,
    defaults: any
  ): Either<Error, any> {
    if (path.includes("://")) {
      return Either.Left(
        new Error(
          `Please provide a path segment instead of a complete url found:'${path}'`
        )
      );
    }

    let bestRank = 0;
    let bestParentMatch = {
      value: {},
      rest: path,
      score: -1,
    };
    let lastParsedParentPath: ParsePath.ParseResult;

    for (const parentPattern of parentPatterns) {
      const parsedPrefix = ParsePath.safe(path, parentPattern);
      lastParsedParentPath = parsedPrefix;

      if (parsedPrefix.tag === "Left") {
        continue;
      }

      if (parsedPrefix.value.score > bestRank) {
        bestParentMatch = parsedPrefix.value;
        bestRank = parsedPrefix.value.score
      }
    }

    if (parentPatterns.length && bestParentMatch.score === -1) {
      return lastParsedParentPath!;
    }

    const { value: parentValue = {}, rest } = bestParentMatch;

    path = rest;
    bestRank = 0;

    let bestRoute: any = null;
    let error: any = null;
    for (const [tag, patterns] of Object.entries(localPatterns)) {
      for (const pattern of patterns) {
        const result = ParsePath.safe(path, normalizePathSegment(pattern));
        if (result.tag === "Left") {
          if (error == null) {
            error = result;
          }
        } else {
          if (bestRoute == null || result.value.score > bestRank) {
            bestRoute = api[tag](
              {
                ...result.value.value,
              },
              { rest: result.value.rest }
            );

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
      bestRoute.value = Object.assign(
        {},
        defaults,
        bestRoute.value,
        parentPatterns.length ? parentValue : {}
      );
      return {
        type: "Either",
        tag: "Right",
        value: bestRoute,
      };
    }
  }

  function fromLocalPath(route: any, defaults: any): any {
    const res = fromLocalPathSafe(route, defaults);
    if (res.tag == "Left") {
      throw res.value;
    } else {
      return res.value;
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
    toLocalPath,
    toLocalPathSafe: toPathInternalSafe,
    fromLocalPath,
    fromLocalPathSafe,
    fromPathOr: fromPathOr,
    fromLocalPathOr: fromLocalPathOr,
    match,
    def,
    otherwise: (...args: any[]) => {
      if (args.length === 0) {
        return otherwise(Object.keys(routes));
      }
      return otherwise(args[0]);
    },
  };

  for (const [tag, dv] of Object.entries(routes)) {
    const of = typeof dv == "function" ? dv : () => dv;
    api[tag] = (_value: any = {}, config?: { rest?: string }) => {
      const { ...value } = _value;
      const context: RouteContext = {
        // prefix: normalizePathSegment(routeContext.prefix),
        rest: normalizeRest(config?.rest ?? ""),
        parentPatterns,
        patterns: api.patterns[tag],
      };

      return { type, tag, value: { ...value }, context };
    };

    api[tag].create = (definition: Definition) => {
      return internalCreate(
        `${type}.${tag}`,
        definition,
        routeContext,
        (parentPatterns.length ? parentPatterns : [""]).flatMap((x) =>
          api.patterns[tag].map((childPattern: string) => x + childPattern)
        )
      );
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
  return api as any as Superoute<N, D, any>;
}

export function create<D extends Definition, N extends string = "Main">(
  definition: D
): Superoute<N, D, null>;
export function create<D extends Definition, N extends string>(
  name: N,
  definition: D
): Superoute<N, D, null>;
export function create<D extends Definition, N extends string>(
  ...args: any[]
): Superoute<N, D, null> {
  if (typeof args[0] === "string") {
    return internalCreate(args[0] as N, args[1] as D, { rest: "", patterns: [], parentPatterns: [] }, []);
  } else {
    return internalCreate("Main" as N, args[0] as D, { rest: "", patterns: [], parentPatterns: [] }, []);
  }
}

export type Tag<A> = A extends API<any, any, any>
  ? Instance<A>["tag"]
  : A extends Instance<any>
  ? A["tag"]
  : A extends { ['superouter/metadata']: any }
  ? A["superouter/metadata"]["value"]
  : never;

export type Value<A> = A extends API<any, any, any>
  ? Instance<A>["value"]
  : A extends Instance<any>
  ? A["value"]
  : A extends { ['superouter/metadata']: any }
  ? A["superouter/metadata"]["value"]
  : never;

export { normalizePathSegment, normalizeRest };
