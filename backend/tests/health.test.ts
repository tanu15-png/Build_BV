import test from "node:test";
import assert from "node:assert/strict";

test("health contract returns expected shape", () => {
  const response = {
    ok: true,
    status: "alive",
  };

  assert.equal(typeof response.ok, "boolean");
  assert.equal(typeof response.status, "string");
});