/* eslint-disable @typescript-eslint/no-explicit-any */
import test from "node:test";
import assert from "node:assert";
import * as superouter from "../lib/index.js";

test("index:  basic", () => {
  const Example = superouter.type("Example", {
    A: (_: { a_id: string }) => `/a/:a_id`,
    B: (_: { b_id: string }) => `/b/:b_id`,
  });

  assert.deepEqual(Example.A({ a_id: "hello" }), {
    type: "Example",
    tag: "A",
    value: { a_id: "hello", rest: "" },
  });
  assert.deepEqual(Example.B({ b_id: "hello" }), {
    type: "Example",
    tag: "B",
    value: { b_id: "hello", rest: "" },
  });

  assert.equal(Example.definition.A({ a_id: "" }), "/a/:a_id");

  assert.deepEqual(Example.patterns, {
    A: ["/a/:a_id"],
    B: ["/b/:b_id"],
  });

  assert.equal(Example.isA(Example.A({ a_id: "cool" })), true);
  assert.equal(Example.isB(Example.A({ a_id: "cool" })), false);

  assert.equal(
    Example.getA("default", (x) => x.a_id, Example.A({ a_id: "cool" })),
    "cool"
  );
  assert.equal(
    Example.getA("default", (x) => x.a_id, Example.B({ b_id: "cool" })),
    "default"
  );
});

test("index:  toPath", () => {
  const Example = superouter.type("Example", {
    A: (_: { a_id: string }) => `/a/:a_id`,
    B: (_: { b_id: string }) => `/b/:b_id`,
    C: (_: { c_id?: string }) => [`/c`, "/c/:c_id"],
  });
  assert.equal(Example.toPath(Example.A({ a_id: "cool" })), "/a/cool");
  assert.throws(
    () => Example.toPath(Example.A({ a_id: "" })),
    /Could not build pattern/
  );

  assert.equal(Example.toPath(Example.C({})), "/c");
  assert.equal(Example.toPath(Example.C({ c_id: undefined })), "/c");
  assert.equal(
    Example.toPath(Example.C({ c_id: null as any as string })),
    "/c"
  );
  assert.equal(
    Example.toPath(Example.C({ c_id: true as any as string })),
    "/c/true"
  );
});
test("index:  fromPath", () => {
  const Example = superouter.type("Example", {
    A: (_: { a_id: string }) => `/a/:a_id`,
    B: (_: { b_id: string }) => `/b/:b_id`,
    C: (_: { c_id?: string }) => [`/c`, "/c/:c_id"],
  });

  assert.throws(() => Example.fromPath("/"), /Expected literal/);
  assert.deepEqual(
    Example.C({ c_id: "cool", rest: "" }),
    Example.fromPath("/c/cool")
  );
  assert.deepEqual(
    Example.C({ c_id: "cool", rest: "" }),
    Example.fromPath("/c/cool")
  );
  assert.deepEqual(Example.C({ c_id: "cool" }), Example.fromPath("/c/cool"));
  assert.deepEqual(Example.C({}), Example.fromPath("/c"));

  assert.throws(() => Example.fromPath("/a"), /Expected binding/);

  {
    const res = Example.fromPathSafe("/a");
    assert(res.tag == "Left");
    assert.match(res.value.message, /Expected binding/);
  }
});

test("index:  match", () => {
  const Example = superouter.type("Example", {
    A: (_: { a_id: string }) => `/a/:a_id`,
    B: (_: { b_id: string }) => `/b/:b_id`,
    C: (_: { c_id?: string }) => [`/c`, "/c/:c_id"],
  });

  const f = (route: superouter.Instance<typeof Example>) =>
    Example.match(route, {
      A: ({ a_id }) => Number(a_id),
      B: ({ b_id }) => Number(b_id),
      C: ({ c_id }) => (c_id ? Number(c_id) : 0),
    });

  assert.equal(f(Example.A({ a_id: "4" })), 4);
  assert.equal(f(Example.B({ b_id: "2" })), 2);
  assert.equal(f(Example.C({ c_id: "100" })), 100);
  assert.equal(f(Example.C({})), 0);

  const _ = Example.otherwise(["B", "C"]);

  const g = (r: superouter.Instance<typeof Example>) =>
    Example.match(r, {
      A: () => 1,
      ..._(() => -1),
    });

  assert.equal(g(Example.A({ a_id: "cool" })), 1);
  assert.equal(g(Example.B({ b_id: "cool" })), -1);
  assert.equal(g(Example.C({ c_id: "cool" })), -1);
});

test("index:  silly", () => {
  // todo-james should this throw?
  const Example = superouter.type("Example", {});

  assert.throws(() => Example.fromPath("/"), /Could not parse url/);
});

// leave undocumented for now, may not make it into final v1
test("index:  matchOr", () => {
  const Example = superouter.type("Example", {
    A: (_: { a_id: string }) => `/a/:a_id`,
    B: (_: { b_id: string }) => `/b/:b_id`,
    C: (_: { c_id?: string }) => [`/c`, "/c/:c_id"],
  });

  {
    const res = Example.matchOr(() => Example.A({ a_id: "cool" }), "/");
    assert.deepEqual(res, Example.A({ a_id: "cool" }));
  }

  {
    const res = Example.matchOr(() => Example.A({ a_id: "cool" }), "/a/notcool");
    assert.deepEqual(res, Example.A({ a_id: "notcool" }));
  }
});

test('index:  rest', () => {
  const Odin = superouter.type('Odin', {
    Home: (_: Record<string,string>) => '/',
    Organization: (_: Record<string, string>) => '/admin/organizations' 
  })

  assert.equal(Odin.toPath(Odin.Organization({ rest: '1' })), '/admin/organizations/1')
  assert.equal(Odin.toPath(Odin.Organization({ rest: '/1' })), '/admin/organizations/1')
  assert.equal(Odin.toPath(Odin.Organization({ rest: '/1/' })), '/admin/organizations/1')
  assert.equal(Odin.toPath(Odin.Organization({ rest: '1/' })), '/admin/organizations/1')

  const Orgs = superouter.type('Orgs', {
    List: (_: { organization_id: string }) => `/:organization_id`,
    Group: (_: { organization_id: string, group_id: string }) => `/:organization_id/groups/:group_id`
  })

  {
    const parentPath = Odin.toPath(Odin.Organization({ rest: '1' }))
  
    const child = Orgs.fromPath(parentPath.replace(`/admin/organizations`, ''))
    
    assert.equal(Orgs.toPath(child), '/1')
  }
  {
    const originalUrl = `/admin/organizations/1/groups/2`

    const originalRoute = Odin.fromPath(originalUrl)

    assert.deepEqual(originalRoute, Odin.Organization({ rest: '1/groups/2' }))

    const parentPath = Odin.toPath(originalRoute)

    assert.equal(originalUrl, parentPath)

    const prefix = `/admin/organizations`
  
    const child = Orgs.fromPath(parentPath.replace(prefix, ''))
    
    assert.equal(Orgs.toPath(child), '/1/groups/2')

    assert.equal(prefix + Orgs.toPath(child), originalUrl)

    
  }
})