import Navbar from "./Navbar.js";
import demoGif from "../public/assets/images/videoforindexhtml.gif";

export default function Home() {
  return (
    <div className="home">
      <Navbar />

      <div className="page-wrapper flex flex-col items-center w-full">
        <div className="home-content-wrapper max-w-7xl mt-16 px-6">
          <section className="intro-section text-center flex flex-col items-center gap-5">
            <h1 className="text-[36px] font-semibold text-[#333]">
              Your personalized reading companion
            </h1>
            <p className="text-[18px] text-[#666] max-w-2xl">
              Select a book, explore with our interactive tools, and let Reading Pal guide your learning journey. Discover how we can enhance your reading experience.
            </p>
            <a href="./dashboard" className="cta-button">
              Get started &rarr;
            </a>
            <div className="gif-container w-full mt-8">
              <img src={demoGif.src} alt="Demo GIF" className="w-full rounded-lg shadow-md" />
            </div>
          </section>

          <div className="divider my-20 h-[1px] bg-[#e0e0e0] w-full" />

          <section id="steps-section" className="flex flex-col items-center gap-12">
            <div className="flex flex-col md:flex-row justify-center gap-10 text-center max-w-5xl">
              {[
                {
                  step: "1",
                  title: "Personalized Book Selection",
                  text: "Filter through a library of books tailored to your preferences, ensuring you find the perfect match for your reading goals.",
                },
                {
                  step: "2",
                  title: "Choose Your Book",
                  text: "Select the book you want to explore and import it directly into Reading Pal for an interactive learning experience.",
                },
                {
                  step: "3",
                  title: "Start Reading Like Never Before",
                  text: "Dive into your book with real-time highlights, voiceovers, and personalized learning tools to enhance your reading journey.",
                },
              ].map(({ step, title, text }) => (
                <div key={step} className="step flex flex-col items-center text-center max-w-xs">
                  <div className="step-number text-3xl font-bold text-[#788cfc] mb-2">{step}</div>
                  <h3 className="text-lg font-semibold mb-2">{title}</h3>
                  <p className="text-sm text-[#555]">{text}</p>
                </div>
              ))}
            </div>
          </section>

          <div className="divider my-20 h-[1px] bg-[#e0e0e0] w-full" />

          <section id="features" className="text-center flex flex-col gap-5">
            <h2 className="text-2xl font-semibold">Features</h2>
            <div className="features-button">Features</div>
            <p className="text-[#666]">
              Explore the key features that make LearnLoom a powerful reading companion.
            </p>

            <div className="features-grid grid grid-cols-1 md:grid-cols-2 gap-10 p-5 max-w-5xl mx-auto">
              {[
                {
                  title: "Personalized Reading Experience",
                  text: "Our platform tailors book recommendations based on your reading preferences, providing a personalized learning experience that helps you stay engaged and improve over time.",
                },
                {
                  title: "Interactive Reading Pal",
                  text: "With adjustable voiceovers, real-time text highlighting, and interactive tools, Reading Pal helps you read at your own pace while providing helpful hints and insights along the way.",
                },
                {
                  title: "Grammar Tool",
                  text: "Improve your writing with our built-in grammar tool. Get feedback on sentence structure, punctuation, and common grammar mistakes. Perfect for students looking to enhance their skills.",
                },
                {
                  title: "Progress Tracking",
                  text: "Keep track of your reading and grammar progress with a save feature.",
                },
              ].map(({ title, text }) => (
                <div key={title} className="feature flex flex-col items-center text-center">
                  <h3 className="font-semibold mb-2">{title}</h3>
                  <p className="text-sm text-[#555]">{text}</p>
                </div>
              ))}
            </div>
          </section>

          <div className="divider my-20 h-[1px] bg-[#e0e0e0] w-full" />

          <section id="faq" className="flex flex-col items-center gap-6">
            <h2 className="text-2xl font-semibold text-center">Frequently Asked Questions</h2>
            <div className="faq-button">FAQ</div>
            <p className="text-center text-[#666] max-w-2xl">
              Let us help answer the most common questions you might have.
            </p>

            <div className="faq-container grid grid-cols-1 md:grid-cols-2 gap-8 px-5 max-w-6xl">
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
                <div key={q} className="faq-item text-center">
                  <h3 className="font-semibold">{q}</h3>
                  <p className="text-sm text-[#555]">{a}</p>
                </div>
              ))}
            </div>
          </section>

          <div className="divider my-20 h-[1px] bg-[#e0e0e0] w-full" />

          <section id="footer-cta" className="text-center mb-20">
            <div className="cta-container flex flex-col md:flex-row justify-center items-center gap-6">
              <div className="cta-text">
                <h3 className="text-lg font-semibold">Let LearnLoom revolutionize reading for you</h3>
                <p className="text-[#666]">Just select a book from our library and let the Reading Pal do the rest for you.</p>
              </div>
              <a href="./dashboard" className="cta-button">Get started &rarr;</a>
            </div>
          </section>

          <footer className="site-footer mt-12">
            <p>© 2025 Skylar Schulsohn. All rights reserved. LearnLoom™ is a trademark of Skylar Schulsohn. For educational use only. No part of this project may be reproduced without permission.</p>
          </footer>
        </div>
      </div>
    </div>
  );
}
