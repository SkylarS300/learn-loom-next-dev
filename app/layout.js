// app/layout.js
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import InitAnonId from "./InitAnonId"; // 👈 ensures anonId cookie
// import Provider from "./SessionProvider"; ❌ Not needed anymore
import Navbar from "/app/Navbar.js";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "LearnLoom",
  description: "Your literacy companion",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <InitAnonId />
        {children}
      </body>
    </html>
  );
}
