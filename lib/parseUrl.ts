/* eslint-disable @typescript-eslint/ban-ts-comment */
import test from "node:test";
import assert from "node:assert";

export type Either<L, R> =
  | { type: "Either"; tag: "Left"; value: L }
  | { type: "Either"; tag: "Right"; value: R };

export function safe(
  _path: string,
  _pattern: string
): Either<
  Error,
  { value: Record<string, string>; rest: string; score: number }
> {

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

  type Mode =
    | "initialize"
    | "collectVarName"
    | "collectVarValue"
    | "collectLiteralName"
    | "collectLiteralValue"
    | "collectRest";

  let mode: Mode = "initialize";
  let prevMode: Mode = "initialize";
  let score = 0;
  const maxIterations = path.length + pattern.length + 1;
  let iterations = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (iterations >= maxIterations) {
      throw new Error(
        `Unexpected recursive logic while parsing path '${_path}' using pattern '${_pattern}'`
      );
    }
    iterations++;

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
  return { type: "Either", tag: "Right", value: { rest, value, score } };
}

export function unsafe(  _path: string, _pattern: string): { rest: string, value: Record<string,string>, score: number } {
    const result = safe(_path, _pattern)
    if (result.tag === 'Left') {
        throw result.value
    } else {
        return result.value
    }
}

test("simple", () => {
  const inputs = [
    ["/welcome/james", "/:name/:nam"],
    ["/welcome/james", "/welcome/:nam"],
    ["/welcome/james/extra", "/welcome/:nam"],
  ] as const;

  const results = inputs.map(([path, pattern]) => safe(path, pattern));

  assert(
    results.filter((x) => x.tag == "Left").length === 0,
    "All can be parsed"
  );

  const best = results
    .flatMap((x) => (x.tag == "Right" ? [x] : []))
    .sort((a, b) => b.value.score - a.value.score)
    .map((x) => x.value)[0];

  assert(best.rest == "/", "most specific wins");

  assert.deepEqual(best.value, { nam: "james" }, "Expected parsed URL");
});

test("rest", () => {
  const inputs = [
    ["/welcome/james", "/welcome/:name"],
    ["/welcome/james/extra", "/welcome/:name"],
  ] as const;

  const results = inputs.map(([path, pattern]) => safe(path, pattern));

  assert(
    results.filter((x) => x.tag == "Left").length === 0,
    "All can be parsed"
  );

  const sorted = results
    .flatMap((x) => (x.tag == "Right" ? [x] : []))
    .sort((a, b) => b.value.score - a.value.score)
    .map((x) => x.value);

  assert(sorted[0].rest == "/", "most specific wins");
  assert(sorted[1].rest == "/extra", "rest has expected value");
  assert.deepEqual(
    sorted[1].value,
    { name: "james" },
    "rest has expected value"
  );
});

test("garbage", () => {
  assert.deepEqual(safe("", ""), {
    type: "Either",
    tag: "Right",
    value: { rest: "/", value: {}, score: 0 },
  });
  assert.deepEqual(safe("////", ""), {
    type: "Either",
    tag: "Right",
    value: { rest: "/", value: {}, score: 0 },
  });
  assert.deepEqual(safe("", "////////"), {
    type: "Either",
    tag: "Right",
    value: { rest: "/", value: {}, score: 0 },
  });
  assert.deepEqual(safe("///////", "////////"), {
    type: "Either",
    tag: "Right",
    value: { rest: "/", value: {}, score: 0 },
  });

  assert.deepEqual(safe("a", ":a"), {
    type: "Either",
    tag: "Right",
    value: { rest: "/", value: { a: "a" }, score: 1 },
  });

  assert.deepEqual(safe(':::::', ':a'), {
    type: 'Either',
    tag: 'Right',
    value: { rest: '/', value: { a: ':::::' }, score: 1 }
  })

  // @ts-expect-error
  assert.throws( () => safe() )
  // @ts-expect-error
  assert.throws( () => safe(''))
  // @ts-expect-error
  assert.throws( () => safe(null, ''))
});

test("complex", () => {
    const inputs = [
      ['', '/a'],
      ['/a', ''],
      ['/a//////', 'a'],
      ["/welcome/james", "/:a/:b/:c/d/e/f/:g"],
      ["/welcome/james/you/d/e/f/cool/and/something/extra", "/:a/:b/:c/d/e/f/:g"],
    ] as const;

    const results = inputs.map( ([path,pattern]) => safe(path, pattern) )

    const failures = results.flatMap( x => x.tag === 'Left' ? [x.value] : [] )
    const success = results.flatMap( x => x.tag === 'Right' ? [x.value] : [] )

    assert.equal(failures.length, 2)
    {
        const [fail] = failures

        assert.match(fail.message, /literal path/)
        assert.match(fail.message, /\/a/)
    }
    {
        const [_, fail] = failures

        assert.match(fail.message, /literal path/)
        assert.match(fail.message, /\/d/)
    }
    assert.deepEqual(success, [
        { rest: '/a', value: {}, score: 0 },
        { rest: '/', value: {}, score: 3 },
        {
          rest: '/and/something/extra',
          value: { a: 'welcome', b: 'james', c: 'you', g: 'cool' },
          score: 19
        }
    ])
});
