import buildFromStatic from "./fromStatic";
import articlesPack from "./packs/exampleArticles"; // optional pack(s)

// Deep merge helper
function mergeBank(target, ...sources) {
    for (const src of sources) {
        for (const concept of Object.keys(src || {})) {
            target[concept] = target[concept] || {};
            const subMap = src[concept] || {};
            for (const sub of Object.keys(subMap)) {
                const node = subMap[sub] || {};
                const tnode = (target[concept][sub] = target[concept][sub] || {
                    easy: [],
                    medium: [],
                    hard: [],
                    pool: [],
                });
                // If pack provides generator, attach it
                if (typeof node.gen === "function") tnode.gen = node.gen;
                // If pack provides prebuilt items, bucket them too
                for (const key of ["easy", "medium", "hard", "pool"]) {
                    if (Array.isArray(node[key])) tnode[key].push(...node[key]);
                }
            }
        }
    }
    return target;
}

const bank = mergeBank(buildFromStatic(), articlesPack);

export default bank; // { [concept]: { [subTopic]: { easy, medium, hard, pool, gen? } } }
