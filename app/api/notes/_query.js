// Thin helper to build Prisma args. This is intentionally pure & tiny so we can unit test it.
export function buildFindArgs({ whereBase, q, select, limit, offset = 0 }) {
    if (!q) {
        return {
            where: whereBase,
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            select,
            take: limit,
        };
    }
    // relevance mode (MySQL boolean FTS)
    return {
        where: {
            AND: [
                whereBase,
                { OR: [{ body: { search: q } }, { anchorText: { search: q } }] },
            ],
        },
        orderBy: [
            { _relevance: { fields: ["body", "anchorText"], search: q, sort: "desc" } },
            { createdAt: "desc" },
        ],
        select,
        skip: offset,
        take: limit,
    };
}
