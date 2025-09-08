// Naive lemmatizer + POS hint for ESL use-cases
const irregulars: Record<string, string> = {
    went: "go", gone: "go", did: "do", done: "do", was: "be", were: "be",
    better: "good", best: "good", worse: "bad", worst: "bad",
    children: "child", men: "man", women: "woman", feet: "foot", teeth: "tooth", mice: "mouse"
};

export function toLemma(raw: string = ""): string {
    const w = (raw || "").toLowerCase().replace(/[^a-z'-]/g, "");
    if (!w) return "";
    if (irregulars[w]) return irregulars[w];
    if (w.endsWith("ies")) return w.slice(0, -3) + "y";
    if (w.endsWith("sses") || w.endsWith("shes") || w.endsWith("ches")) return w.slice(0, -2);
    if (w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
    if (w.endsWith("ing")) return w.replace(/ing$/, "").replace(/(.)\1$/, "$1");
    if (w.endsWith("ed")) return w.replace(/ed$/, "");
    return w;
}

export function detectPOS(raw: string = ""): string {
    const w = raw.toLowerCase();
    if (/ly$/.test(w)) return "adv.";
    if (/ing$|ed$/.test(w)) return "v.";
    if (/ous$|ful$|able$|ible$|ish$|al$|ic$|ive$/.test(w)) return "adj.";
    return "n./v.";
}