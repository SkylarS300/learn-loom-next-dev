import books from "../../public/Content/book-list";
import Navbar from "../Navbar";
import Link from "next/link";

export default function Library(){

        // function populateBooks() {
        //     const bookContainer = document.getElementById('bookContainer');
        //     books.forEach((book) => {
        //         const bookWrapper = document.createElement('div');
        //         const bookImage = document.createElement('img');
        //         bookImage.src = book.cover;
        //         bookImage.alt = `${book.title} by ${book.author}`;
        //         bookImage.classList.add('book-cover');
        //         bookImage.addEventListener('click', () => {
        //             window.location.href = `readingpal.html?bookIndex=${book.index}`;
        //         });

        //         const bookTitle = document.createElement('p');
        //         bookTitle.textContent = book.title;
        //         bookTitle.classList.add('book-title');

        //         bookWrapper.appendChild(bookImage);
        //         bookWrapper.appendChild(bookTitle);
        //         bookContainer.appendChild(bookWrapper);
        //     });
        // }

        // window.onload = populateBooks;

        function onClick(book){
            window.location.href = `readingpal.html?bookIndex=${book.index}`
        }

    return <div>
        <center>
            <Navbar />
        <h1>Select a Book to Read:</h1>
    </center>
    <div id="bookContainer" class="book-container">
        {books.map((book) => {
            return (
            <Link href ="/readingpal" state = {{bookIndex: book.index}} class="book-wrapper">
                <img class= "bookImage" src={book.cover} alt={`${book.title} by ${book.author}`}></img>
                <p class = "book-title" textContent = {book.title}></p>
            </Link>
        );})}
    </div>
    </div>
}