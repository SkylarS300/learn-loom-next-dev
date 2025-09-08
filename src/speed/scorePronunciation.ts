//src/speech/scorePronunciation.ts
// Offline scoring proxy (fictional): we estimate difficulty by grapheme pattern only.
export function scorePronunciation(target: string) {
    const t = (target || "").toLowerCase().replace(/[^a-z]/g, "");
    if (!t) return { score: 0.5, tips: "Try saying the word clearly once more." };
    // heuristics: penalize consonant clusters, irregular ‘ough’, ending -ed/-th
    let s = 0.9;
    if (/[^aeiou]{3,}/.test(t)) s -= 0.1;
    if (/ough/.test(t)) s -= 0.15;
    if (/(th|ed|rl|l[dt])$/.test(t)) s -= 0.1;
    s = Math.max(0.2, Math.min(1, s));
    const tip =
        /th/.test(t) ? "Place your tongue lightly between the teeth for ‘th’." :
            /r/.test(t) ? "Relax the tongue for American ‘r’; avoid trilling." :
                /l/.test(t) ? "For clear ‘l’, touch the alveolar ridge behind your teeth." :
                    "Speak slowly; stress the main vowel sound.";
    return { score: s, tips: tip };
}
