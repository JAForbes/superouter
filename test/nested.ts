import assert from "node:assert";
import * as superouter from "../lib";
import { describe, it } from "node:test";

describe("nested", () => {
  const A = superouter.create({
    Redirect: "/",
    LoggedIn: (_: { organization_id: string }) => "/:organization_id",
  });

  const B = A.LoggedIn.create({
    Admin: "/admin",
    Projects: "/projects",
  });

  const C = B.Admin.create({
    Organizations: "/organizations",
    Roles: (_: { role_id: string }) => "/roles/:role_id",
    Groups: (_: { group_id: string }) => "/groups/:group_id",
  });

  const a = A.LoggedIn({ organization_id: "cool" });
  const b = B.Admin({ organization_id: "cool" });
  const c = C.Roles({ organization_id: "nice", role_id: "basic" });
  it("constructors", () => {
    
    assert.deepEqual(a, {
      type: "Main",
      tag: "LoggedIn",
      value: { organization_id: "cool" },
      context: {
        parentPatterns: [],
        patterns: [
          '/:organization_id'
        ],
        rest: ''
      }
    });
    
    assert.deepEqual(b, {
      type: "Main.LoggedIn",
      tag: "Admin",
      value: { organization_id: "cool" },
      context: {
        parentPatterns: [
          '/:organization_id'
        ],
        patterns: [
          '/admin'
        ],
        rest: ''
      },
    });
  
    
    assert.deepEqual(c, {
      type: "Main.LoggedIn.Admin",
      tag: "Roles",
      value: { organization_id: "nice", role_id: "basic" },
      context: {
        parentPatterns: [
          '/:organization_id/admin'
        ],
        patterns: [
          '/roles/:role_id'
        ],
        rest: ''
      },
    });

  })

  it('toPath / toLocalPath', () => {
    assert.equal(`/cool`, A.toPath(a));
    assert.equal(`/cool`, A.toLocalPath(a));

    assert.equal(`/cool/admin`, B.toPath(b));
    assert.equal(`/admin`, B.toLocalPath(b));

    assert.equal(`/nice/admin/roles/basic`, C.toPath(c));
    assert.equal(`/roles/basic`, C.toLocalPath(c));
  })

  it('fromPath / fromLocalPath', () => {

    assert.deepEqual(A.fromPath("/cool/admin/roles/basic"), {
      type: "Main",
      tag: "LoggedIn",
      value: { organization_id: "cool" },
      context: {
        parentPatterns: [],
        patterns: [
          '/:organization_id'
        ],
        rest: 'admin/roles/basic'
      },
    });
    assert.deepEqual(B.fromPath("/cool/admin/roles/basic"), {
      type: "Main.LoggedIn",
      tag: "Admin",
      value: { organization_id: "cool" },
      context: {
        parentPatterns: [
          '/:organization_id'
        ],
        patterns: [
          '/admin'
        ],
        rest: 'roles/basic'
      },
    });
    assert.deepEqual(C.fromPath("/cool/admin/roles/basic"), {
      type: "Main.LoggedIn.Admin",
      tag: "Roles",
      value: { role_id: "basic", organization_id: "cool" },
      context: {
        parentPatterns: [
          '/:organization_id/admin'
        ],
        patterns: [
          '/roles/:role_id'
        ],
        rest: ''
      },
    });

    assert.deepEqual(
      C.fromLocalPath("/roles/wizard", { organization_id: "nice" }),
      {
        type: "Main.LoggedIn.Admin",
        tag: "Roles",
        value: { organization_id: "nice", role_id: "wizard" },
        context: {
          parentPatterns: [
            '/:organization_id/admin'
          ],
          patterns: [
            '/roles/:role_id'
          ],
          rest: ''
        },
      }
    );

  })

  it('from super-mithril-examples', () => {
    const Route = superouter.create({
      Redirect: `/`,
      Example: `/examples`,
    })
    const ExampleRoute = Route.Example.create({
      SevenGuis: '/seven-guis',
      StopWatch: '/stopwatch',
      TapeDeck: '/tapedeck',
      TicTacToe: '/tic-tac-toe',
    })
    const SevenGuisRoute = ExampleRoute.SevenGuis.create({
      Redirect: '/',
      Counter: '/counter',
      TemperatureContrived: '/temperature/contrived',
      TemperatureSimple: '/temperature/simple',
      FlightBooker: '/flight',
      Timer: '/timer',
      CRUD: '/crud',
      CircleDrawer: '/circles',
      Cells: '/cells'
    })
    const CrudRoute = SevenGuisRoute.CRUD.create({
      NoSelection: '/',
      Create: '/create',
      Update: (_: { id: string }) => '/update/:id',
    })

    const actual = CrudRoute.fromPath('/examples/seven-guis/crud').context.rest
    assert.equal(actual, '')
  })
});
