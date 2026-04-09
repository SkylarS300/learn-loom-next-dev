// app/page.jsx
import Image from "next/image";
import demoGif from "../public/assets/images/videoforindexhtml.gif";
import styles from "./home.module.css";

export default function Home() {
  return (
    <div>
      <main className={styles.wrap}>
        {/* HERO */}
        <section className={`${styles.hero} ${styles.fadeUp}`} style={{ "--ad": "0s" }}>
          <h1 className={styles.heroTitle}>Your personalized reading companion</h1>
          <p className={styles.heroSub}>
            Select a book, explore with our interactive tools, and let Reading Pal guide your learning
            journey. Discover how we can enhance your reading experience.
          </p>
          <div className={styles.actions}>
            <a href="/dashboard" className="cta-button" aria-label="Get started on your dashboard">
              Get started &rarr;
            </a>
          </div>

          <div className={`${styles.gifCard} ${styles.fadeUp}`} style={{ "--ad": ".05s" }}>
            <Image
              src={demoGif}
              alt="Reading Pal demo"
              priority
              unoptimized
              style={{ width: "100%", height: "auto", display: "block" }}
            />
          </div>
        </section>

        <div className={styles.divider} />

        {/* STEPS */}
        <section className={styles.fadeUp} style={{ "--ad": ".05s" }}>
          <div className={styles.stepsRow}>
            {[
              {
                step: "1",
                title: "Pick what to read",
                text: "Choose from our starter library or bring your own text. Short sessions work great.",
              },
              {
                step: "2",
                title: "Read with the Pal",
                text: "Highlight, listen along, and add quick notes. Everything is tuned for focus.",
              },
              {
                step: "3",
                title: "Practice + track",
                text: "Target weak spots with bite-size grammar quizzes and see gentle progress over time.",
              },
            ].map(({ step, title, text }) => (
              <div key={step} className={styles.stepCard} aria-label={`Step ${step}: ${title}`}>
                <div className={styles.stepNumber}>{step}</div>
                <h3 className={styles.stepTitle}>{title}</h3>
                <p className={styles.stepText}>{text}</p>
              </div>
            ))}
          </div>
        </section>

        <div className={styles.divider} />

        {/* FEATURES */}
        <section id="features" className={styles.fadeUp} style={{ "--ad": ".05s" }}>
          {/* center the heading/pill/intro */}
          <div style={{ display: "grid", justifyItems: "center", textAlign: "center", gap: 6 }}>
            <h2 className={styles.sectionTitle}>Features</h2>
            <div className={styles.pill} aria-hidden style={{ width: "fit-content" }}>
              Features
            </div>
            <p className={styles.sectionIntro}>
              Explore the key features that make LearnLoom a powerful reading companion.
            </p>
          </div>

          <div className={styles.featuresGrid}>
            {[
              {
                title: "Reading Pal",
                text: "Inline highlighting, optional voiceover, quick notes, and bookmarks for a smoother reading flow.",
              },
              {
                title: "Upload your own",
                text: "Bring PDFs or text and use the same tools—no extra setup. Private by default.",
              },
              {
                title: "Smart grammar practice",
                text: "Short drills that adapt to you. Review mistakes and build confidence without the stress.",
              },
              {
                title: "Private progress",
                text: "Your ‘progress code’ is your identity—no email needed. Keep reading history on any device.",
              },
            ].map(({ title, text }) => (
              <div key={title} className={styles.featureCard}>
                <h3 className={styles.featureTitle}>{title}</h3>
                <p className={styles.featureText}>{text}</p>
              </div>
            ))}
          </div>
        </section>

        <div className={styles.divider} />

        {/* FAQ */}
        <section id="faq" className={styles.fadeUp} style={{ "--ad": ".05s" }}>
          {/* center the heading/pill/intro */}
          <div style={{ display: "grid", justifyItems: "center", textAlign: "center", gap: 6 }}>
            <h2 className={styles.sectionTitle}>Frequently Asked Questions</h2>
            <div className={styles.pill} aria-hidden style={{ width: "fit-content" }}>
              FAQ
            </div>
            <p className={styles.sectionIntro} style={{ maxWidth: "40rem", margin: "0 auto" }}>
              Let us help answer the most common questions you might have.
            </p>
          </div>

          <div className={styles.faqGrid} role="list">
            {[
              ["Do I need an email or account?", "No. You get a private progress code you can use on any device."],
              ["Is my reading private?", "Yes. Uploads are private by default. You control sharing via codes."],
              ["Can I upload my own text?", "Yes—PDF or text. You’ll get the same Reading Pal tools and notes."],
              ["Does it work on phones?", "We recommend a laptop/desktop for now to keep the UI simple and focused."],
              ["How are recommendations made?", "We surface quick suggestions based on what you practice and where you struggle."],
              ["What’s the grammar tool like?", "Fast multiple-choice checks with hints and explanations. Great for warmups."],
              ["Is LearnLoom free?", "Yes."],
              ["Can I export my notes?", "Yes—use the ‘Export’ actions in the dashboard to download your notes."],
            ].map(([q, a]) => (
              <div key={q} className={styles.faqItem} role="listitem">
                <h3 className={styles.faqQ}>{q}</h3>
                <p className={styles.faqA}>{a}</p>
              </div>
            ))}
          </div>
        </section>

        <div className={styles.divider} />

        {/* Footer CTA */}
        <section id="footer-cta" className={`${styles.footerCta} ${styles.fadeUp}`} style={{ "--ad": ".05s" }}>
          <div className={styles.footerRow}>
            <div>
              <h3 className={styles.stepTitle}>Let LearnLoom revolutionize reading for you</h3>
              <p className={styles.stepText}>
                Just select a book from our library and let the Reading Pal do the rest for you.
              </p>
            </div>
            <a href="/dashboard" className="cta-button">Get started &rarr;</a>
          </div>
        </section>

        <footer className={styles.siteFooter}>
          <p>
            © 2025 Skylar. All rights reserved. LearnLoom™ is a trademark of Skylar S.
            For educational use only. No part of this project may be reproduced without permission.
          </p>
        </footer>
      </main>
    </div>
  );
}
