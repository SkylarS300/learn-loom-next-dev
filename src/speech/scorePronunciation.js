// Lightweight pronunciation scorer for the client.
// Compares the target text vs a recognized transcript (or typed attempt).
// Intentionally simple (no audio processing): Levenshtein + per-word checks + basic tips.

function normalize(str = "") {
    return String(str)
        .toLowerCase()
        .replace(/[^a-z'\s-]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function levenshtein(a = "", b = "") {
    const m = a.length, n = b.length;
    if (m === 0) return n;
    if (n === 0) return m;
    const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
        const ca = a.charCodeAt(i - 1);
        for (let j = 1; j <= n; j++) {
            const cb = b.charCodeAt(j - 1);
            const cost = ca === cb ? 0 : 1;
            dp[i][j] = Math.min(
                dp[i - 1][j] + 1,      // delete
                dp[i][j - 1] + 1,      // insert
                dp[i - 1][j - 1] + cost // substitute
            );
        }
    }
    return dp[m][n];
}

function perWord(target, said) {
    const tw = normalize(target).split(" ").filter(Boolean);
    const sw = normalize(said).split(" ").filter(Boolean);
    const len = Math.max(tw.length, sw.length) || 1;
    const rows = [];
    let correct = 0;
    for (let i = 0; i < len; i++) {
        const t = tw[i] || "";
        const s = sw[i] || "";
        const d = levenshtein(t, s);
        const maxLen = Math.max(t.length, s.length, 1);
        const ratio = 1 - d / maxLen; // 1.0 exact match
        const ok = ratio >= 0.7; // tolerant
        if (ok) correct++;
        rows.push({ target: t, said: s, ok, ratio, distance: d });
    }
    return { rows, accuracy: correct / len };
}

function buildTips(rows) {
    const tips = [];
    const miss = rows.filter(r => !r.ok);
    if (!miss.length) return tips;
    // Sound pattern nudges
    const patterns = [
        { re: /th/, msg: "Try soft 'th' sound (think 'this' / 'thing')." },
        { re: /r/, msg: "Roll the 'r' lightly; avoid adding a vowel before it." },
        { re: /l/, msg: "Touch the tip of your tongue to the ridge behind your teeth for 'l'." },
        { re: /v/, msg: "Use your bottom lip against your upper teeth for 'v'." },
        { re: /w/, msg: "Round your lips for 'w' (don’t turn it into 'v')." },
        { re: /ed$/, msg: "Remember past tense '-ed' can sound like /t/, /d/, or /ɪd/." },
        { re: /(tion|sion)$/, msg: "Stress usually falls before '-tion' or '-sion' (e.g., 'na-TION')." },
        { re: /(ity)$/, msg: "In '-ity' words, stress often moves left (e.g., e-LEC-tri-ty)." },
    ];
    for (const r of miss.slice(0, 4)) {
        for (const p of patterns) {
            if (p.re.test(r.target)) { tips.push(`“${r.target}”: ${p.msg}`); break; }
        }
    }
    // Generic suggestion
    tips.push("Say it slowly once, then again faster. Emphasize vowel sounds.");
    return tips;
}

export function scorePronunciation(targetText = "", attemptText = "") {
    const a = normalize(targetText);
    const b = normalize(attemptText);
    const charDist = levenshtein(a, b);
    const maxLen = Math.max(a.length, b.length, 1);
    const charScore = Math.max(0, 1 - charDist / maxLen); // 0..1
    const { rows, accuracy } = perWord(a, b);
    // Weighted blend: words > characters
    const blended = 0.7 * accuracy + 0.3 * charScore;
    const score = Math.round(blended * 100);
    const tips = buildTips(rows);
    return {
        score,
        wordAccuracy: accuracy,
        charSimilarity: charScore,
        details: rows,
        tips,
    };
}
