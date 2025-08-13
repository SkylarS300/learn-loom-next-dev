// app/layout.js
import "./globals.css";
import { Geist, Geist_Mono } from "next/font/google";
import InitAnonId from "./InitAnonId";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata = { title: "LearnLoom", description: "Your literacy companion" };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {/* ensures anonId cookie exists for your API routes */}
        <InitAnonId />
        {children}
      </body>
    </html>
  );
}
