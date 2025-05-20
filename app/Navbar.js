import Link from 'next/link';
import logo from '../public/assets/images/learnloom.png'

export default function Navbar(){
    return <div className="px-10"> <div id = "navbar" className="w-full flex flex-row justify-between py-1 px-10 shadow-md">
      <a className="logo">
        <img src={logo.src} alt = "LearnLoom Logo" className="w-20 l-20" />
      </a>

      <ul className="nav-links flex flex-row gap-8 justify-center items-center">
        <li>
          <Link href = "/"> Home </Link>
        </li>
        <li>
          <Link href = "/library" >Library</Link>
        </li>
        <li>
          <Link href = "/readingpal" state = {{bookIndex: null}}>ReadingPal</Link>
        </li>
        <li>
          <Link href = "/grammar">Grammar</Link>
        </li>
        <li>Features</li>
        <li>FAQ</li>
      </ul>

      <div className="login-button flex flex-row items-center justify-center">Login</div>
    </div></div>
}