"use client";

import books from "../../public/Content/book-list";
import Navbar from "../Navbar";
import { useRouter } from "next/navigation";

export default function Library() {
  const router = useRouter();

  function handleClick(book) {
    router.push(`/readingpal?bookIndex=${book.index}`);
  }

  return (
    <>
      <Navbar />
      <main className="library-wrapper">
        <h1 className="library-heading">Select a Book to Read:</h1>
        <div className="book-grid">
          {books.map((book) => (
            <div
              key={book.index}
              className="book-card"
              onClick={() => handleClick(book)}
            >
              <img
                className="book-cover"
                src={book.cover}
                alt={`${book.title} by ${book.author}`}
              />
              <p className="book-title">{book.title}</p>
              <p className="book-author">{book.author}</p>
            </div>
          ))}
        </div>
      </main>
    </>
  );
}
