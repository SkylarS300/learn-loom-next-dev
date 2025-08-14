// Example dynamic pack: programmatically generate article questions
function makeItem(noun, article) {
    const prompt = `Choose the correct article: ___ ${noun}`;
    const choices = ["A", "An", "The", "—"];
    const answerIndex = article === "An" ? 1 : article === "A" ? 0 : article === "The" ? 2 : 3;
    return {
        id: `articles:${noun}`,
        kind: "mcq",
        prompt,
        choices,
        answerIndex,
        explanation: `Use "${article}" before ${/^[aeiou]/i.test(noun) ? "vowel" : "consonant"} sounds.`,
        meta: { difficulty: "easy" },
    };
}

export default {
    Articles: {
        Basics: {
            gen: (count = 8) => {
                const nouns = ["apple", "banana", "old oak", "university", "hour", "book", "idea", "elephant"];
                const items = [];
                for (let i = 0; i < Math.min(count, nouns.length); i++) {
                    const n = nouns[i];
                    const art = /^[aeiou]|^hour/i.test(n) ? "An" : "A";
                    items.push(makeItem(n, art));
                }
                return items;
            },
        },
    },
};
