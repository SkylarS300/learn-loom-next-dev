"use client";

import quizzes from "../../public/Content/quizzes.js";
import logo from '@/public/assets/images/learnloom.png';
import Navbar from "../Navbar";
import { useEffect } from "react";

export default function Grammar() {
  let selectedCategory = null;
  let userAnswers = {};

function checkQuestions(event) {
  event.preventDefault();
  const questions = selectedCategory.questions;
  let allCorrect = true;

  questions.forEach((question, index) => {
    const explanationDiv = document.getElementById(`explanation-${index}`);
    let userAnswer;

    if (question.type === "multiple-choice") {
      const userAnswerElement = document.querySelector(`input[name="q${index}"]:checked`);

      if (userAnswerElement) {
        userAnswer = parseInt(userAnswerElement.value);
        userAnswers[`q${index}`] = userAnswer;
        const correctAnswer = question.correctAnswer;

        if (userAnswer === correctAnswer) {
          explanationDiv.textContent = "Correct!";
          explanationDiv.className = "correct";
        } else {
          allCorrect = false;
          explanationDiv.textContent = `Incorrect: ${question.explanation}`;
          explanationDiv.className = "incorrect";
        }
      } else {
        allCorrect = false;
        explanationDiv.textContent = "Please provide an answer!";
        explanationDiv.className = "warning";
      }
    } else if (question.type === "short-response") {
      const userAnswerElement = document.querySelector(`input[name="q${index}"]`);

      if (userAnswerElement) {
        userAnswer = userAnswerElement.value.trim();
        userAnswers[`q${index}`] = userAnswer;
        const correctAnswer = question.correctAnswer;

        if (userAnswer === correctAnswer) {
          explanationDiv.textContent = "Correct!";
          explanationDiv.className = "correct";
        } else {
          allCorrect = false;
          explanationDiv.textContent = `Incorrect: ${question.explanation}`;
          explanationDiv.className = "incorrect";
        }
      } else {
        allCorrect = false;
        explanationDiv.textContent = "Please provide a response!";
        explanationDiv.className = "warning";
      }
    }
  });

  if (allCorrect) {
    alert("Congratulations! All your answers are correct!");
  }
}


  function generateQuestion(category) {
    selectedCategory = category;
    const questions = selectedCategory.questions;
    const quizContainer = document.getElementById("textContainer");
    quizContainer.innerHTML = "";

    const titleText = document.createElement("h1");
    titleText.textContent = selectedCategory.subConcept;

    const desc = document.createElement("h3");
    desc.textContent = selectedCategory.explanation;

    const form = document.createElement("form");
    form.setAttribute("action", "/submit.test");
    form.setAttribute("method", "GET");

    questions.forEach((question, index) => {
      const questionDiv = document.createElement("div");

      const questionLabel = document.createElement("label");
      questionLabel.textContent = `${index + 1}. ${question.question}`;
      questionDiv.appendChild(questionLabel);
      questionDiv.appendChild(document.createElement("br"));

      if (question.type === "multiple-choice") {
        question.choices.forEach((choice, choiceIndex) => {
          const radio = document.createElement("input");
          radio.setAttribute("type", "radio");
          radio.setAttribute("name", `q${index}`);
          radio.setAttribute("value", choiceIndex);

          const label = document.createElement("label");
          label.textContent = choice;

          questionDiv.appendChild(radio);
          questionDiv.appendChild(label);
          questionDiv.appendChild(document.createElement("br"));
        });
      }

      if (question.type === "short-response") {
        const input = document.createElement("input");
        input.setAttribute("type", "text");
        input.setAttribute("name", `q${index}`);
        questionDiv.appendChild(input);
        questionDiv.appendChild(document.createElement("br"));
      }

      const explanationDiv = document.createElement("div");
      explanationDiv.setAttribute("id", `explanation-${index}`);
      explanationDiv.style.marginTop = "10px";

      questionDiv.appendChild(explanationDiv);
      form.appendChild(questionDiv);
      form.appendChild(document.createElement("br"));
    });

    const submitButton = document.createElement("input");
    submitButton.setAttribute("type", "submit");
    submitButton.setAttribute("value", "Submit Test");
    form.appendChild(submitButton);

    quizContainer.appendChild(titleText);
    quizContainer.appendChild(desc);
    quizContainer.appendChild(form);
    form.addEventListener("submit", checkQuestions);
  }

  useEffect(() => {
    generateQuestion(quizzes["SentenceStructure"].subConcepts[0]);
  }, []);

  return (
    <div id="main-content" className="grammar-layout">
      <Navbar />
      <div className="grammar-columns">
        <div id="quizList" className="grammar-sidebar">
          <h2>Sentence Structure</h2>
          <a onClick={() => generateQuestion(quizzes.SentenceStructure.subConcepts[0])} className="subsection-link">Simple Sentences</a><br />
          <a onClick={() => generateQuestion(quizzes.SentenceStructure.subConcepts[1])} className="subsection-link">Compound Sentences</a><br />
          <a onClick={() => generateQuestion(quizzes.SentenceStructure.subConcepts[2])} className="subsection-link">Complex Sentences</a>

          <h2>Punctuation</h2>
          <a onClick={() => generateQuestion(quizzes.Punctuation.subConcepts[0])} className="subsection-link">Commas</a><br />
          <a onClick={() => generateQuestion(quizzes.Punctuation.subConcepts[1])} className="subsection-link">Apostrophes</a><br />
          <a onClick={() => generateQuestion(quizzes.Punctuation.subConcepts[2])} className="subsection-link">Quotation Marks</a>

          <h2>Common Grammar Mistakes</h2>
          <a onClick={() => generateQuestion(quizzes.CommonGrammarMistakes.subConcepts[0])} className="subsection-link">Subject-Verb Agreement</a><br />
          <a onClick={() => generateQuestion(quizzes.CommonGrammarMistakes.subConcepts[1])} className="subsection-link">Misplaced Modifiers</a><br />
          <a onClick={() => generateQuestion(quizzes.CommonGrammarMistakes.subConcepts[2])} className="subsection-link">Double Negatives</a>

          <h2>Verb Tenses</h2>
          <a onClick={() => generateQuestion(quizzes.verbTenses.subConcepts[0])} className="subsection-link">Present Simple vs. Present Continuous</a><br />
          <a onClick={() => generateQuestion(quizzes.verbTenses.subConcepts[1])} className="subsection-link">Past Simple vs. Past Continuous</a><br />
          <a onClick={() => generateQuestion(quizzes.verbTenses.subConcepts[2])} className="subsection-link">Future Simple vs. Future Continuous</a>

          <h2>Word Usage</h2>
          <a onClick={() => generateQuestion(quizzes.WordUsage.subConcepts[0])} className="subsection-link">Homophones</a><br />
          <a onClick={() => generateQuestion(quizzes.WordUsage.subConcepts[1])} className="subsection-link">Commonly Confused Words</a><br />
          <a onClick={() => generateQuestion(quizzes.WordUsage.subConcepts[2])} className="subsection-link">Synonyms and Antonyms</a>

          <h2>Writing Style</h2>
          <a onClick={() => generateQuestion(quizzes.WritingStyle.subConcepts[0])} className="subsection-link">Formal vs. Informal Writing</a><br />
          <a onClick={() => generateQuestion(quizzes.WritingStyle.subConcepts[1])} className="subsection-link">Active vs. Passive Voice</a><br />
          <a onClick={() => generateQuestion(quizzes.WritingStyle.subConcepts[2])} className="subsection-link">Concise vs. Wordy Writing</a>
        </div>

        <div id="textContainer" className="grammar-content"></div>
      </div>
    </div>
  );
}
