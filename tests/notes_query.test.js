import { describe, it, expect } from "vitest";
import { buildFindArgs } from "../app/api/notes/_query.js";

describe("buildFindArgs", () => {
    const base = { anonId: "abc", targetType: "grammar" };
    const select = { id: true, body: true };

    it("builds non-search args with stable ordering", () => {
        const args = buildFindArgs({ whereBase: base, q: "", select, limit: 50 });
        expect(args.where).toEqual(base);
        expect(args.orderBy).toEqual([{ createdAt: "desc" }, { id: "desc" }]);
        expect(args.take).toBe(50);
    });

    it("builds search args with _relevance ordering", () => {
        const args = buildFindArgs({ whereBase: base, q: "fox dog", select, limit: 25, offset: 50 });
        expect(args.where.AND[1].OR).toHaveLength(2);
        expect(args.orderBy[0]._relevance.search).toBe("fox dog");
        expect(args.skip).toBe(50);
        expect(args.take).toBe(25);
    });
});
