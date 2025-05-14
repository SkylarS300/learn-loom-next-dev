import Navbar from "./Navbar.js";
import demoGif from "./assets/images/videoforindexhtml.gif"

export default function Home(){

    return <div className="home">
      <Navbar />

      <div class="page-wrapper flex flex-row justify-center w-full">

      <div class="home-content-wrapper max-w-7xl mt-25">
      <div class = "intro-section flex flex-col justify-center text-center gap-5">
    <h1 class = "title text-[36px] font-[600] text-color-[#333]">Your personalized reading companion</h1>
    <p class = "paragraph text-[18px] text-color-[#666] max-w-800">Select a book, explore with our interactive tools, and let Reading Pal guide your learning journey. Discover how we can enhance your reading experience.</p>

    <a href="./login.html" class="cta-button get-started-btn">Get started &rarr;</a>
    
    <div class="gif-container">
      <img src={demoGif.src} alt="Demo GIF" class="responsive-gif w-full"></img>
  </div>

  </div>
  

  <div id="steps-section" class= "flex flex-row gap-15 justify-center mt-50">
    <div class="step flex flex-col justify-center text-center">
      <div class="step-number">1</div>
      <h3>Personalized Book Selection</h3>
      <p>Filter through a library of books tailored to your preferences, ensuring you find the perfect match for your reading goals.</p>
    </div>

  <div class = "step flex flex-col justify-center text-center">
    <div class = "step-number">2</div>
    <h3>Choose Your Book</h3>
    <p>Select the book you want to explore and import it directly into Reading Pal for an interactive learning experience.</p>
  </div>

  <div class = "step flex flex-col justify-center text-center">
    <div class = "step-number">3</div>
    <h3>Start Reading Like Never Before</h3>
    <p>Dive into your book with real-time highlights, voiceovers, and personalized learning tools to enhance your reading journey.</p>
  </div>
</div>

  <div class="divider"></div>

  <div id="features" class="text-center flex flex-col gap-5 mt-50">

    <h2>Features</h2>

    <div class="features-button">Features</div>
    <p>Explore the key features that make LearnLoom a powerful reading companion.</p>
    
    <div class = "features-grid flex flex-row justify-center align-center p-5">
      <div class = "feature flex flex-col justify-center align-center text-center">
        <h3>Personalized Reading Experience</h3>
        <p>Our platform tailors book recommendations based on your reading preferences, providing a personalized learning experience that helps you stay engaged and improve over time.</p>
      </div>
      <div class = "feature flex flex-col justify-center align-center text-center ">
        <h3>Interactive Reading Pal</h3>
        <p>With adjustable voiceovers, real-time text highlighting, and interactive tools, Reading Pal helps you read at your own pace while providing helpful hints and insights along the way.</p>
      </div>
      <div class = "feature flex flex-col justify-center align-center text-center">
        <h3>Grammar Tool</h3>
        <p>Improve your writing with our built-in grammar tool. Get feedback on sentence structure, punctuation, and common grammar mistakes. Perfect for students looking to enhance their skills.</p>         
      </div>
      <div class = "feature flex flex-col justify-center align-center text-center">
        <h3>Progress Tracking</h3>
        <p>Keep track of your reading and grammar progress with a save feature.</p>
      </div>
    </div>
  </div>

  <div class = "flex flex-col gap-5 mt-50" id="faq">

    <div class="faq-divider"></div>
    <h2 class = "text-center">Frequently Asked Questions</h2>

    <div class = "faq-button text-center">FAQ</div>
    <p class = "text-center">Let us help answer the most common questions you might have.</p>

    <div class = "faq-container grid grid-cols-2 grid-rows-4 gap-6 p-5">
        <div class = "faq-item text-center">
        <h3>How does LearnLoom recommend books?</h3>
        <p>LearnLoom uses a filtering algorithm to recommend books based on your reading habits and preferences. The more you read and more specific you are, the better the recommendations.</p>
        </div>

        <div class = "faq-item text-center">
        <h3>Can I upload my own books?</h3>
        <p>Yes! You can upload PDFs, Word documents, or text files to the platform and use the Reading Pal features with your own content.</p>
        </div> 

        <div class = "faq-item text-center">
        <h3>How does the voiceover feature work?</h3>
        <p>Reading Pal's voiceover reads aloud any selected text while highlighting the words on screen. You can adjust the speed, pitch, color of the highlights, and even the language of the voiceover to suit your needs within the settings.</p>
        </div>

        <div class = "faq-item text-center">
        <h3>Is LearnLoom free to use?</h3>
        <p>Yes, LearnLoom's features are all completely free to use.</p>
        </div>

        <div class = "faq-item text-center">
        <h3>How can I track my reading progress?</h3>
        <p>You can track your reading progress through the "Progress Tracking" feature on your dashboard. It shows you how much you've read, completed quizzes, and your performance on grammar exercises.</p>
        </div>

        <div class = "faq-item text-center">
        <h3>Can I adjust the voiceover settings in Reading Pal?</h3>
        <p>Yes! You can adjust the speed, pitch, volume, and language of the voiceover in the Reading Pal settings. You can also highlight text in sync with the audio for a fully customizable reading experience.</p>
        </div>

        <div class = "faq-item text-center">
        <h3>What types of documents can I upload to the platform?</h3>
        <p>You can upload PDFs, text files, and Word documents. The system will automatically convert them into readable and interactive formats for use with the Reading Pal.</p>
        </div>

        <div class = "faq-item text-center">
        <h3>Can I use the platform on mobile devices?</h3>
        <p>No, unfortunately LearnLoom is not multi-platform as of yet and is only compatible on computers.</p>
        </div>
    </div>
  </div>

  <div id = "footer-cta">
    <div class = "cta-container flex flex-row justify-center mt-50 mb-50">
      <div class = "cta-text text-center">
        <h3>Let LearnLoom revolutionize reading for you</h3>
        <p>Just select a book from our library and let the Reading Pal do the rest for you.</p>
      </div>
      <a href="./login.html" class="cta-button">Get started &rarr;</a>
    </div>
    <div class = "footer-divider"></div>
  </div>
  </div>
  </div>
  </div>

}