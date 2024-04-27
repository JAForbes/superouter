import { Either } from "./either.js";
import { normalizeRest } from "./normalize.js";

type Mode =
| "initialize"
| "collectVarName"
| "collectVarValue"
| "collectLiteralName"
| "collectLiteralValue"
| "collectRest";


export type ParseResult = 
  Either<Error, { value: Record<string, string>; rest: string; score: number }>

// todo-james this is already single pass / O(n)
// but we could probably scan both the pattern and path
// mutually which could be faster, worth a try?
export function safe(
  _path: string,
  _pattern: string
): ParseResult {

  if (_path == null ) {
    throw new Error('Provided path was null but must be a URL path')
  }
  if (_pattern == null ) {
    throw new Error('Provided pattern was null but must be a URL pattern')
  }
  const path = _path + "/";
  const pattern = _pattern + "/";

  let pathI = 0;
  let patternI = 0;

  const value: Record<string, string> = {};

  let varName = "";
  let varValue = "";
  let literalName = "";
  let literalValue = "";
  let rest = "/";

  let mode: Mode = "initialize";
  let prevMode: Mode = "initialize";
  let score = 0;
  const maxIterations = path.length + pattern.length;
  let iterations = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (mode == "initialize") {
      while (pattern[patternI] === "/") {
        patternI++;
        continue;
      }

      while (path[pathI] === "/") {
        pathI++;
        continue;
      }

      if (prevMode == "collectLiteralName") {
        mode = "collectLiteralValue";
        literalValue = "";
        continue;
      }

      if (prevMode == "collectVarName") {
        if (varName in value) {
          return {
            type: "Either",
            tag: "Left",
            value: new Error(`Pattern has duplicated varName ':${varName}'`),
          };
        }
        score += 2;
        mode = "collectVarValue";
        varValue = "";
        continue;
      }

      if (prevMode == "collectLiteralValue") {
        if (literalName !== literalValue) {
          return {
            type: "Either",
            tag: "Left",
            value: new Error(
              `Expected literal path segment '/${literalName}' but instead found '/${literalValue}'`
            ),
          };
        }
        score += 4;
        literalName = "";
        literalValue = "";
      }

      if (prevMode == "collectVarValue") {
        if (!varValue) {
          return {
            type: "Either",
            tag: "Left",
            value: new Error(
              `Expected binding for path variable ':${varName}' but instead found nothing'`
            ),
          };
        }
        value[varName] = varValue;
        varName = "";
        varValue = "";
      }

      if (pattern[patternI] === ":") {
        mode = "collectVarName";
        varName = "";
        patternI++;
      } else if (pattern[patternI] != null) {
        mode = "collectLiteralName";
        literalName = "";
      } else if (path[pathI] != null) {
        mode = "collectRest";
      } else {
        break;
      }
    }

    if (iterations >= maxIterations) {
      throw new Error(
        `Unexpected recursive logic while parsing path '${_path}' using pattern '${_pattern}'`
      );
    }
    iterations++;

    if (
      (mode == "collectLiteralName" || mode == "collectVarName") &&
      pattern[patternI] === "/"
    ) {
      prevMode = mode;
      mode = "initialize";
      continue;
    }
    if (
      (mode == "collectLiteralValue" ||
        mode == "collectVarValue" ||
        mode == "collectRest") &&
      path[pathI] === "/"
    ) {
      prevMode = mode;
      mode = "initialize";
      continue;
    }
    if (
      (mode == "collectLiteralName" || mode == "collectVarName") &&
      pattern[patternI] == null
    ) {
      prevMode = mode;
      mode = "initialize";
      continue;
    }
    if (
      (mode == "collectLiteralValue" ||
        mode == "collectVarValue" ||
        mode == "collectRest") &&
      path[pathI] == null
    ) {
      prevMode = mode;
      mode = "initialize";
      continue;
    }

    if (mode == "collectLiteralName") {
      literalName += pattern[patternI];
      patternI++;
      continue;
    }
    if (mode == "collectLiteralValue") {
      literalValue += path[pathI];
      pathI++;
      continue;
    }
    if (mode == "collectVarName") {
      varName += pattern[patternI];
      patternI++;
      continue;
    }
    if (mode == "collectVarValue") {
      varValue += path[pathI];
      pathI++;
      continue;
    }
    if (mode == "collectRest") {
      // pathI + 1 because of trailing slash
      while (path[pathI + 1] != null) {
        rest += path[pathI];
        pathI++;
      }
      break;
    }
  }

  // prefer exact match
  if (rest) {
    score = Math.max(0, score - 1);
  }
  return { type: "Either", tag: "Right", value: { rest: normalizeRest(rest), value, score } };
}

export function unsafe(  _path: string, _pattern: string): { rest: string, value: Record<string,string>, score: number } {
    const result = safe(_path, _pattern)
    if (result.tag === 'Left') {
        throw result.value
    } else {
        return result.value
    }
}

