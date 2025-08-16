// app/page.jsx
import Navbar from "./Navbar.js";
import Image from "next/image";
import demoGif from "../public/assets/images/videoforindexhtml.gif";
import styles from "./home.module.css";

export default function Home() {
  return (
    <div>
      <Navbar />

      <main className={styles.wrap}>
        {/* HERO */}
        <section className={`${styles.hero} ${styles.fadeUp}`} style={{ "--ad": "0s" }}>
          <h1 className={styles.heroTitle}>Your personalized reading companion</h1>
          <p className={styles.heroSub}>
            Select a book, explore with our interactive tools, and let Reading Pal guide your learning
            journey. Discover how we can enhance your reading experience.
          </p>
          <a href="/dashboard" className="cta-button" aria-label="Get started on your dashboard">
            Get started &rarr;
          </a>

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
                title: "Personalized Book Selection",
                text:
                  "Filter through a library of books tailored to your preferences, ensuring you find the perfect match for your reading goals.",
              },
              {
                step: "2",
                title: "Choose Your Book",
                text:
                  "Select the book you want to explore and import it directly into Reading Pal for an interactive learning experience.",
              },
              {
                step: "3",
                title: "Start Reading Like Never Before",
                text:
                  "Dive into your book with real-time highlights, voiceovers, and personalized learning tools to enhance your reading journey.",
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
          <h2 className={styles.sectionTitle}>Features</h2>
          <div className={styles.pill} aria-hidden>Features</div>
          <p className={styles.sectionIntro}>
            Explore the key features that make LearnLoom a powerful reading companion.
          </p>

          <div className={styles.featuresGrid}>
            {[
              {
                title: "Personalized Reading Experience",
                text:
                  "Our platform tailors book recommendations based on your reading preferences, providing a personalized learning experience that helps you stay engaged and improve over time.",
              },
              {
                title: "Interactive Reading Pal",
                text:
                  "With adjustable voiceovers, real-time text highlighting, and interactive tools, Reading Pal helps you read at your own pace while providing helpful hints and insights along the way.",
              },
              {
                title: "Grammar Tool",
                text:
                  "Improve your writing with our built-in grammar tool. Get feedback on sentence structure, punctuation, and common grammar mistakes.",
              },
              {
                title: "Progress Tracking",
                text: "Keep track of your reading and grammar progress with a save feature.",
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
          <h2 className={styles.sectionTitle}>Frequently Asked Questions</h2>
          <div className={styles.pill} aria-hidden>FAQ</div>
          <p className={styles.sectionIntro} style={{ maxWidth: "40rem", margin: "0 auto" }}>
            Let us help answer the most common questions you might have.
          </p>

          <div className={styles.faqGrid} role="list">
            {[
              ["How does LearnLoom recommend books?", "LearnLoom uses a filtering algorithm to recommend books based on your reading habits and preferences. The more you read and more specific you are, the better the recommendations."],
              ["Can I upload my own books?", "Yes! You can upload PDFs, Word documents, or text files to the platform and use the Reading Pal features with your own content."],
              ["How does the voiceover feature work?", "Reading Pal's voiceover reads aloud any selected text while highlighting the words on screen. You can adjust the speed, pitch, color of the highlights, and even the language of the voiceover."],
              ["Is LearnLoom free to use?", "Yes, LearnLoom’s features are all completely free to use."],
              ["How can I track my reading progress?", "You can track your reading progress through the 'Progress Tracking' feature on your dashboard."],
              ["Can I adjust the voiceover settings in Reading Pal?", "Yes! You can adjust the speed, pitch, volume, and language of the voiceover. You can also highlight text in sync with the audio."],
              ["What types of documents can I upload?", "You can upload PDFs, text files, and Word documents. The system will automatically convert them into readable formats for use with Reading Pal."],
              ["Can I use the platform on mobile devices?", "No, LearnLoom is currently only available on computers."],
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
            © 2025 Skylar Schulsohn. All rights reserved. LearnLoom™ is a trademark of Skylar Schulsohn.
            For educational use only. No part of this project may be reproduced without permission.
          </p>
        </footer>
      </main>
    </div>
  );
}
