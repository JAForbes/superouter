/* eslint-disable @typescript-eslint/ban-ts-comment */
import test from "node:test";
import assert from "node:assert";
import { safe } from "../lib/fromPath.js";

test("fromPath: simple", () => {
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

test("fromPath: rest", () => {
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

test("fromPath: garbage", () => {
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

  assert.deepEqual(safe(":::::", ":a"), {
    type: "Either",
    tag: "Right",
    value: { rest: "/", value: { a: ":::::" }, score: 1 },
  });

  // @ts-expect-error
  assert.throws(() => safe());
  // @ts-expect-error
  assert.throws(() => safe(""));
  // @ts-expect-error
  assert.throws(() => safe(null, ""));
});

test("fromPath: complex", () => {
  const inputs = [
    ["", "/a"],
    ["/a", ""],
    ["/a//////", "a"],
    ["/welcome/james", "/:a/:b/:c/d/e/f/:g"],
    ["/welcome/james/you/d/e/f/cool/and/something/extra", "/:a/:b/:c/d/e/f/:g"],
  ] as const;

  const results = inputs.map(([path, pattern]) => safe(path, pattern));

  const failures = results.flatMap((x) => (x.tag === "Left" ? [x.value] : []));
  const success = results.flatMap((x) => (x.tag === "Right" ? [x.value] : []));

  assert.equal(failures.length, 2);
  {
    const [fail] = failures;

    assert.match(fail.message, /literal path/);
    assert.match(fail.message, /\/a/);
  }
  {
    const [_, fail] = failures;

    assert.match(fail.message, /Expected binding/);
    assert.match(fail.message, /:c/);
  }
  assert.deepEqual(success, [
    { rest: "/a", value: {}, score: 0 },
    { rest: "/", value: {}, score: 3 },
    {
      rest: "/and/something/extra",
      value: { a: "welcome", b: "james", c: "you", g: "cool" },
      score: 19,
    },
  ]);
});

test("fromPath: odin", () => {

  const res = safe("/data/schedules", "/data/schedules/:schedule_id")

  assert( res.tag == 'Left')
  assert.match(res.value.message, /variable ':schedule_id'/)
  console.log(res)
})
