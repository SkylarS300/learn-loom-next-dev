// app/help/page.jsx (SERVER)
import Link from "next/link";
import styles from "./help.module.css";

export const metadata = {
    title: "How to use LearnLoom",
    description: "A guide to LearnLoom's library, Reading Pal, grammar practice, and privacy model.",
};

const sections = [
    {
        id: "library",
        title: "Library",
        body: (
            <>
                <p>
                    The Library is where you find something to read. Browse by genre, reading level, or
                    subject matter until something looks interesting — there&apos;s no ranking or grading
                    happening here, just a way to find a good fit.
                </p>
                <p>
                    Once you find a book, open it directly into Reading Pal.
                </p>
            </>
        ),
        link: { href: "/library", label: "Go to Library" },
    },
    {
        id: "readingpal",
        title: "Reading Pal",
        body: (
            <>
                <p>Reading Pal is built to make dense text easier to work through. While reading you can:</p>
                <ul>
                    <li>Have the text read aloud, with the current sentence highlighted as it&apos;s spoken.</li>
                    <li>Adjust font size and highlight color to whatever&apos;s comfortable for you.</li>
                    <li>Jump between sentences, pause and resume, or pick up right where you left off.</li>
                    <li>Leave notes or bookmarks anchored to specific sentences.</li>
                </ul>
                <p>
                    You can also upload your own text (a PDF or pasted text) if you want to read something
                    that isn&apos;t in the Library.
                </p>
            </>
        ),
        link: { href: "/readingpal", label: "Open Reading Pal" },
    },
    {
        id: "grammar",
        title: "Study Grammar",
        body: (
            <>
                <p>
                    Grammar practice is organized into short quizzes by topic — sentence structure,
                    punctuation, and more. Every question comes with an explanation, whether you get it
                    right or wrong, so you&apos;re not just guessing until something sticks.
                </p>
                <p>Your scores are tracked so you can see which topics could use more practice.</p>
            </>
        ),
        link: { href: "/grammar", label: "Start a grammar quiz" },
    },
    {
        id: "code-and-privacy",
        title: "Your code, and how privacy works here",
        body: (
            <>
                <p>
                    LearnLoom doesn&apos;t ask for your name, email, or any other personal information to use
                    it. Instead, when you first visit, you get a short anonymous code (something like{" "}
                    <code>AB12-XY34-9K</code>). That code is how your reading progress, notes, and quiz
                    scores are saved.
                </p>
                <p>
                    <strong>Keep your code somewhere safe</strong> — it&apos;s the only way to get back to your
                    progress on another device, and it can&apos;t be recovered if it&apos;s lost. You can copy it
                    or show a QR code for it anytime from the navigation bar.
                </p>
            </>
        ),
    },
    {
        id: "dashboard",
        title: "Dashboard",
        body: (
            <p>
                Your Dashboard is a home base: recent reading progress, grammar quiz history, saved notes,
                and — if a teacher has set them — any assigned work.
            </p>
        ),
        link: { href: "/dashboard", label: "Go to Dashboard" },
    },
    {
        id: "accessibility",
        title: "Accessibility",
        body: (
            <p>
                Reading Pal&apos;s font size, highlight color, and text-to-speech controls are there to make
                reading work for you, not the other way around — there&apos;s no “right” way to use them.
                They&apos;re currently set per reading session; if you&apos;d like these preferences to carry
                across the whole site, let us know — it&apos;s something we&apos;re looking to add.
            </p>
        ),
    },
];

export default function HelpPage() {
    return (
        <main className={styles.wrap}>
            <h1>How to use LearnLoom</h1>
            <p className={styles.intro}>
                LearnLoom is a reading and grammar practice tool built to make challenging texts more
                approachable and grammar practice less intimidating. Here&apos;s what&apos;s here and how to
                use it — no need to ask a teacher first.
            </p>

            <nav aria-label="Guide sections" className={styles.toc}>
                <ul>
                    {sections.map((s) => (
                        <li key={s.id}>
                            <a href={`#${s.id}`}>{s.title}</a>
                        </li>
                    ))}
                </ul>
            </nav>

            {sections.map((s) => (
                <section key={s.id} id={s.id} className={styles.section} aria-labelledby={`${s.id}-heading`}>
                    <h2 id={`${s.id}-heading`}>{s.title}</h2>
                    {s.body}
                    {s.link && (
                        <Link href={s.link.href} className={styles.sectionLink}>
                            {s.link.label} →
                        </Link>
                    )}
                </section>
            ))}
        </main>
    );
}
