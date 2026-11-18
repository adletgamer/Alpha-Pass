import { describe, expect, it } from "vitest";
import { assertMutationOrigin, InvalidOriginError } from "./request-origin";

describe("mutation origin", () => {
  const target = "https://alpha-pass.test/api/escrow/release";

  it("rejects a write without Origin", () => {
    expect(() => assertMutationOrigin(new Request(target, {
      method: "POST", headers: { host: "alpha-pass.test" },
    }))).toThrow(InvalidOriginError);
  });

  it("rejects another origin", () => {
    expect(() => assertMutationOrigin(new Request(target, {
      method: "POST", headers: { host: "alpha-pass.test", origin: "https://other.test" },
    }))).toThrow(InvalidOriginError);
  });

  it("accepts the same origin and allows reads without Origin", () => {
    expect(() => assertMutationOrigin(new Request(target, {
      method: "POST", headers: { host: "alpha-pass.test", origin: "https://alpha-pass.test" },
    }))).not.toThrow();
    expect(() => assertMutationOrigin(new Request(target))).not.toThrow();
  });
});
