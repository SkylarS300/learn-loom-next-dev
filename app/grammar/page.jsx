"use client";

import quizzes from "../../public/Content/quizzes.js";
import Navbar from "../Navbar";
import { useEffect } from "react";

export default function Grammar(){
      
      var selectedCategory = null
      
      // Object to store user answers
      let userAnswers = {};

      useEffect(() => {
        // Function to check user's selected answers and compare with correct answers
      function checkQuestions(event) {
        event.preventDefault(); // Prevent the form from refreshing the page
        
        const questions = selectedCategory.questions; 
        let allCorrect = true; // Variable to track if all answers are correct
      
        // Loop through all the questions
        questions.forEach((question, index) => {
          const explanationDiv = document.getElementById(`explanation-${index}`);
          
          let userAnswer;
          
          // Check if the question is multiple-choice or short-response
          if (question.type === 'multiple-choice') {
            // For multiple-choice
            const userAnswerElement = document.querySelector(`input[name="q${index}"]:checked`);
            
            if (userAnswerElement) {
              userAnswer = parseInt(userAnswerElement.value); // Parse as integer for multiple-choice
              
              // Save the user's selected answer
              userAnswers[`q${index}`] = userAnswer;
              
              // Compare the selected answer with the correct answer
              const correctAnswer = question.correctAnswer;
              
              if (userAnswer === correctAnswer) {
                explanationDiv.textContent = "Correct!";
                explanationDiv.style.color = "green";
              } else {
                allCorrect = false;
                explanationDiv.textContent = `Incorrect: ${question.explanation}`;
                explanationDiv.style.color = "red";
              }
            } else {
              // If no answer was selected, prompt the user to select an answer
              allCorrect = false;
              explanationDiv.textContent = "Please provide an answer!";
              explanationDiv.style.color = "orange";
            }
            
          } else if (question.type === 'short-response') {
            const userAnswerElement = document.querySelector(`input[name="q${index}"]`);
            
            if (userAnswerElement) {
              userAnswer = userAnswerElement.value.trim(); 
              
              // Save the user's answer into arr
              userAnswers[`q${index}`] = userAnswer;
              
              // Compare the text answer with the correct answer (case-sensitive)
              const correctAnswer = question.correctAnswer;
              
              if (userAnswer === correctAnswer) {
                explanationDiv.textContent = "Correct!";
                explanationDiv.style.color = "green";
              } else {
                allCorrect = false;
                explanationDiv.textContent = `Incorrect: ${question.explanation}`;
                explanationDiv.style.color = "red";
              }
            } else {
              // If no answer was provided
              allCorrect = false;
              explanationDiv.textContent = "Please provide a response!";
              explanationDiv.style.color = "orange";
            }
          }
        });
      
        // If all questions are correct, display a message
        if (allCorrect) {
          alert("Congratulations! All your answers are correct!");
        }
      }
      
      // Example function that saves userAnswers for future use
      function saveUserAnswers() {
        // Here you could implement logic to save userAnswers to local storage, a database, or server
        console.log("User answers saved:", userAnswers);
        // Example of saving to local storage
        localStorage.setItem("userAnswers", JSON.stringify(userAnswers));
      }
      
      // Function to generate the quiz dynamically
      function generateQuestion(questions) {
        selectedCategory = questions
        questions = selectedCategory.questions
        const quizContainer = document.getElementById('textContainer');
        quizContainer.innerHTML = '';
      
        const titleText = document.createElement('h1');
        titleText.textContent = selectedCategory.subConcept;
      
        const desc = document.createElement('h3');
        desc.textContent = selectedCategory.explanation;
      
        const form = document.createElement('form');
        form.setAttribute('action', '/submit.test');
        form.setAttribute('method', 'GET');
      
        questions.forEach((question, index) => {
          const questionDiv = document.createElement('div');
      
          // Add the question text
          const questionLabel = document.createElement('label');
          questionLabel.textContent = `${index + 1}. ${question.question}`;
          questionDiv.appendChild(questionLabel);
          questionDiv.appendChild(document.createElement('br'));
      
          // Handle multiple-choice questions
          if (question.type === 'multiple-choice') {
            question.choices.forEach((choice, choiceIndex) => {
              const radio = document.createElement('input');
              radio.setAttribute('type', 'radio');
              radio.setAttribute('name', `q${index}`);
              radio.setAttribute('value', choiceIndex);
      
              const label = document.createElement('label');
              label.textContent = choice;
      
              questionDiv.appendChild(radio);
              questionDiv.appendChild(label);
              questionDiv.appendChild(document.createElement('br'));
            });
          }
          
          if (question.type === 'short-response') {
            const input = document.createElement('input');
            input.setAttribute('type', 'text');
            input.setAttribute('name', `q${index}`);
            questionDiv.appendChild(input);
            questionDiv.appendChild(document.createElement('br'));
          }
           
      
          // Create an explanation div for feedback after submission
          const explanationDiv = document.createElement('div');
          explanationDiv.setAttribute('id', `explanation-${index}`);
          explanationDiv.style.marginTop = '10px';
      
          questionDiv.appendChild(explanationDiv);
          form.appendChild(questionDiv);
          form.appendChild(document.createElement('br'));
        });
      
        // Submit button
        const submitButton = document.createElement('input');
        submitButton.setAttribute('type', 'submit');
        submitButton.setAttribute('value', 'Submit Test');
        form.appendChild(submitButton);
      
        // Append the form to the quizContainer
        quizContainer.appendChild(titleText)
        quizContainer.appendChild(desc)
        quizContainer.appendChild(form);
        
        // Add event listener to check questions on form submission
        form.addEventListener('submit', checkQuestions);
      }
      
      // Call the function to generate the form on page load
      document.addEventListener('DOMContentLoaded', () => {
        const questions = quizzes["SentenceStructure"].subConcepts[0].questions; // Use the first subConcept's questions
        generateQuestion(questions);
      });
      }, []);
      

      return <div id="main-content">
        <Navbar />
      <div id="quizList" >
        <h2>Sentence Structure</h2>
        <a href="javascript:selectedCategory = quizzes.SentenceStructure.subConcepts[0]; generateQuestion(selectedCategory);" className="subsection-link" data-subsection="Simple Sentences">Simple Sentences</a>
        <br />
        <a href="javascript:selectedCategory = quizzes.SentenceStructure.subConcepts[1]; generateQuestion(selectedCategory);" className="subsection-link" data-subsection="Compound Sentences">Compound Sentences</a>
        <br />
        <a href="javascript:selectedCategory = quizzes.SentenceStructure.subConcepts[2]; generateQuestion(selectedCategory);" className="subsection-link" data-subsection="Complex Sentences">Complex Sentences</a>

        <h2>Punctuation</h2>
        <a href="javascript:selectedCategory = quizzes.Punctuation.subConcepts[0]; generateQuestion(selectedCategory);" className="subsection-link" data-subsection="Commas">Commas</a>
        <br />
        <a href="javascript:selectedCategory = quizzes.Punctuation.subConcepts[1]; generateQuestion(selectedCategory);" className="subsection-link" data-subsection="Apostrophes">Apostrophes</a>
        <br />
        <a href="javascript:selectedCategory = quizzes.Punctuation.subConcepts[2]; generateQuestion(selectedCategory);" className="subsection-link" data-subsection="Quotation Marks">Quotation Marks</a>

        <h2>Common Grammar Mistakes</h2>
        <a href="javascript:selectedCategory = quizzes.CommonGrammarMistakes.subConcepts[0]; generateQuestion(selectedCategory);" className="subsection-link" data-subsection="Subject-Verb Agreement">Subject-Verb Agreement</a>
        <br />
        <a href="javascript:selectedCategory = quizzes.CommonGrammarMistakes.subConcepts[1]; generateQuestion(selectedCategory);" className="subsection-link" data-subsection="Misplaced Modifiers">Misplaced Modifiers</a>
        <br />
        <a href="javascript:selectedCategory = quizzes.CommonGrammarMistakes.subConcepts[2]; generateQuestion(selectedCategory);" className="subsection-link" data-subsection="Double Negatives">Double Negatives</a>

        <h2>Verb Tenses</h2>
        <a href="javascript:selectedCategory = quizzes.verbTenses.subConcepts[0]; generateQuestion(selectedCategory);" className="subsection-link" data-subsection="Present Simple vs. Present Continuous">Present Simple vs. Present Continuous</a>
        <br />
        <a href="javascript:selectedCategory = quizzes.verbTenses.subConcepts[1]; generateQuestion(selectedCategory);" className="subsection-link" data-subsection="Past Simple vs. Past Continuous">Past Simple vs. Past Continuous</a>
        <br />
        <a href="javascript:selectedCategory = quizzes.verbTenses.subConcepts[2]; generateQuestion(selectedCategory);" className="subsection-link" data-subsection="Future Simple vs. Future Continuous">Future Simple vs. Future Continuous</a>

        <h2>Word Usage</h2>
        <a href="javascript:selectedCategory = quizzes.WordUsage.subConcepts[0]; generateQuestion(selectedCategory);" className="subsection-link" data-subsection="Homophones">Homophones</a>
        <br />
        <a href="javascript:selectedCategory = quizzes.WordUsage.subConcepts[1]; generateQuestion(selectedCategory);" className="subsection-link" data-subsection="Commonly Confused Words">Commonly Confused Words</a>
        <br />
        <a href="javascript:selectedCategory = quizzes.WordUsage.subConcepts[2]; generateQuestion(selectedCategory);" className="subsection-link" data-subsection="Synonyms and Antonyms">Synonyms and Antonyms</a>

        <h2>Writing Style</h2>
        <a href="javascript:selectedCategory = quizzes.WritingStyle.subConcepts[0]; generateQuestion(selectedCategory);" className="subsection-link" data-subsection="Formal vs. Informal Writing">Formal vs. Informal Writing</a>
        <br />
        <a href="javascript:selectedCategory = quizzes.WritingStyle.subConcepts[1]; generateQuestion(selectedCategory);" className="subsection-link" data-subsection="Active vs. Passive Voice">Active vs. Passive Voice</a>
        <br />
        <a href="javascript:selectedCategory = quizzes.WritingStyle.subConcepts[2]; generateQuestion(selectedCategory);" className="subsection-link" data-subsection="Concise vs. Wordy Writing">Concise vs. Wordy Writing</a>
      </div>

    <div id="textContainer"></div>
    </div>
}