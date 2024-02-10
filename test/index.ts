import test from "node:test";
import assert from "node:assert";
import * as superouter from "../lib/index.js";

test("basic", () => {
  const Example = superouter.type("Example", {
    A: (_: { a_id: string }) => `/a/:a_id`,
    B: (_: { b_id: string }) => `/b/:b_id`,
  });

  assert.deepEqual(Example.A({ a_id: "hello" }), {
    type: "Example",
    tag: "A",
    value: { a_id: "hello" },
  });
  assert.deepEqual(Example.B({ b_id: "hello" }), {
    type: "Example",
    tag: "B",
    value: { b_id: "hello" },
  });
  
  assert.equal(Example.definition.A({ a_id: '' }), '/a/:a_id')

  assert.deepEqual(Example.patterns, {
    A: ['/a/:a_id'],
    B: ['/b/:b_id']
  })

  assert.equal(Example.isA(Example.A({ a_id: 'cool' })), true)
  assert.equal(Example.isB(Example.A({ a_id: 'cool' })), false)

  assert.equal(Example.getA( 'default', x => x.a_id, Example.A({ a_id: 'cool' })), 'cool')
  assert.equal(Example.getA( 'default', x => x.a_id, Example.B({ b_id: 'cool' })), 'default')

});
