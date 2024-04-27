/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it } from "node:test";
import assert from "node:assert";
import * as superouter from "../lib/index.js";

const defaultContext = {
  rest: "",
};

describe("index", () => {
  it("basic", () => {
    const Example = superouter.create("Example", {
      A: (_: { a_id: string }) => `/a/:a_id`,
      B: (_: { b_id: string }) => `/b/:b_id`,
    });

    assert.deepEqual(Example.A({ a_id: "hello" }), {
      type: "Example",
      tag: "A",
      value: { a_id: "hello" },
      context: defaultContext,
    });
    assert.deepEqual(Example.B({ b_id: "hello" }), {
      type: "Example",
      tag: "B",
      value: { b_id: "hello" },
      context: defaultContext,
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

  it("toPath", () => {
    const Example = superouter.create("Example", {
      A: (_: { a_id: string }) => `/a/:a_id`,
      B: (_: { b_id: string }) => `/b/:b_id`,
      C: (_: { c_id?: string }) => [`/c`, "/c/:c_id"],
    });
    assert.equal(Example.toPath(Example.A({ a_id: "cool" })), "/a/cool");
    assert.throws(
      () => Example.toPath(Example.A({ a_id: "" })),
      /Could not build pattern \/a\/:a_id/
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

  it("fromPath", () => {
    const Example = superouter.create("Example", {
      A: (_: { a_id: string }) => `/a/:a_id`,
      B: (_: { b_id: string }) => `/b/:b_id`,
      C: (_: { c_id?: string }) => [`/c`, "/c/:c_id"],
    });

    assert.throws(() => Example.fromPath("/"), /Expected literal/);
    assert.deepEqual(
      Example.C({ c_id: "cool" }, { rest: "" }),
      Example.fromPath("/c/cool")
    );
    assert.deepEqual(
      Example.C({ c_id: "cool" }, { rest: "" }),
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

  it("anonymous routes", () => {
    const Main = superouter.create({
      A: (_: { a_id: string }) => `/a/:a_id`,
      B: (_: { b_id: string }) => `/b/:b_id`,
      C: `/c`,
    });

    assert.deepEqual(Main.A({ a_id: "wow" }), {
      type: "Main",
      tag: "A",
      value: { a_id: "wow" },
      context: defaultContext,
    });
  });

  it("match", () => {
    const Example = superouter.create("Example", {
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

    {
      const _ = Example.otherwise(["B", "C"]);

      const g = (r: superouter.Instance<typeof Example>) =>
        Example.match(r, {
          A: () => 1,
          ..._(() => -1),
        });

      assert.equal(g(Example.A({ a_id: "cool" })), 1);
      assert.equal(g(Example.B({ b_id: "cool" })), -1);
      assert.equal(g(Example.C({ c_id: "cool" })), -1);
    }
    {
      const _ = Example.otherwise();

      const g = (r: superouter.Instance<typeof Example>) =>
        Example.match(r, {
          ..._(() => -1),
          A: () => 1,
        });

      assert.equal(g(Example.A({ a_id: "cool" })), 1);
      assert.equal(g(Example.B({ b_id: "cool" })), -1);
      assert.equal(g(Example.C({ c_id: "cool" })), -1);
    }
  });

  it("silly", () => {
    // todo-james should this throw?
    const Example = superouter.create("Example", {});

    assert.throws(() => Example.fromPath("/"), /Could not parse url/);
  });

  // leave undocumented for now, may not make it into final v1
  it("fromPathOr", () => {
    const Example = superouter.create("Example", {
      A: (_: { a_id: string }) => `/a/:a_id`,
      B: (_: { b_id: string }) => `/b/:b_id`,
      C: (_: { c_id?: string }) => [`/c`, "/c/:c_id"],
    });

    {
      const res = Example.fromPathOr(() => Example.A({ a_id: "cool" }), "/");
      assert.deepEqual(res, Example.A({ a_id: "cool" }));
    }

    {
      const res = Example.fromPathOr(
        () => Example.A({ a_id: "cool" }),
        "/a/notcool"
      );
      assert.deepEqual(res, Example.A({ a_id: "notcool" }));
    }
  });

  it("rest", () => {
    const Odin = superouter.create("Odin", {
      Home: (_: Record<string, string>) => "/",
      Organization: (_: Record<string, string>) => "/admin/organizations",
    });

    assert.equal(
      Odin.toPath(Odin.Organization({}, { rest: "1" })),
      "/admin/organizations/1"
    );
    assert.equal(
      Odin.toPath(Odin.Organization({}, { rest: "/1" })),
      "/admin/organizations/1"
    );
    assert.equal(
      Odin.toPath(Odin.Organization({}, { rest: "/1/" })),
      "/admin/organizations/1"
    );
    assert.equal(
      Odin.toPath(Odin.Organization({}, { rest: "1/" })),
      "/admin/organizations/1"
    );

    const Orgs = superouter.create("Orgs", {
      List: (_: { organization_id: string }) => `/:organization_id`,
      Group: (_: { organization_id: string; group_id: string }) =>
        `/:organization_id/groups/:group_id`,
    });

    {
      const parentPath = Odin.toPath(Odin.Organization({}, { rest: "1" }));

      const child = Orgs.fromPath(
        parentPath.replace(`/admin/organizations`, "")
      );

      assert.equal(Orgs.toPath(child), "/1");
    }
    {
      const originalUrl = `/admin/organizations/1/groups/2`;

      const originalRoute = Odin.fromPath(originalUrl);

      assert.deepEqual(
        originalRoute,
        Odin.Organization({}, { rest: "1/groups/2" })
      );

      const parentPath = Odin.toPath(originalRoute);

      assert.equal(originalUrl, parentPath);

      const prefix = `/admin/organizations`;

      const child = Orgs.fromPath(parentPath.replace(prefix, ""));

      assert.equal(Orgs.toPath(child), "/1/groups/2");

      assert.equal(prefix + Orgs.toPath(child), originalUrl);
    }
  });
});
