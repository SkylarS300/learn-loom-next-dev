export default function Navbar(){
    return <div class = "px-10"> <div id = "navbar" class = "w-full flex flex-row justify-between py-1 px-10 shadow-md">
      <a class = "logo">
        <img src="./src/assets/images/learnloom.png" alt = "LearnLoom Logo" class = "w-20 l-20" />
      </a>

      <ul class = "nav-links flex flex-row gap-8 justify-center items-center">
        <li>
          <div to = "/">Home</div>
        </li>
        <li>
          <div to = "/library">Library</div>
        </li>
        {/* <li>
          <Link to = "/readingpal" state = {{bookIndex: null}}>ReadingPal</Link>
        </li> */}
        <li>
          <div to = "/grammar">Grammar</div>
        </li>
        <li>Features</li>
        <li>FAQ</li>
      </ul>

      <div class = "login-button flex flex-row items-center justify-center">Login</div>
    </div></div>
}