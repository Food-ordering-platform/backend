import { describe, it } from "node:test";
import { strict as assert } from "node:assert";

describe('Server Check', () => {
    it('should pass this simple test', () => {
        expect(1 + 1).toBe(2);
    });
});

function expect(value: number) {
    return {
        toBe: (expected: number) => {
            assert.equal(value, expected);
        }
    };
}
