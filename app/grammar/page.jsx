"use client";

import quizzes from "@/src/content/quizzes.js";
import Navbar from "../Navbar";
import logo from "@/public/assets/images/learnloom.png";
import { useEffect } from "react";

export default function Grammar() {
  let selectedCategory = null;
  let userAnswers = {};

  async function checkQuestions(event) {
    event.preventDefault();
    const questions = selectedCategory.questions;
    let allCorrect = true;
    let correctCount = 0;

    questions.forEach((question, index) => {
      const explanationDiv = document.getElementById(`explanation-${index}`);
      let userAnswer;

      if (question.type === "multiple-choice") {
        const userAnswerElement = document.querySelector(`input[name="q${index}"]:checked`);
        if (userAnswerElement) {
          userAnswer = parseInt(userAnswerElement.value);
          const correctAnswer = question.correctAnswer;

          if (userAnswer === correctAnswer) {
            explanationDiv.textContent = "Correct!";
            explanationDiv.className = "correct";
            correctCount++;
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
      }

      if (question.type === "short-response") {
        const userAnswerElement = document.querySelector(`input[name="q${index}"]`);
        if (userAnswerElement) {
          userAnswer = userAnswerElement.value.trim();
          const correctAnswer = question.correctAnswer;

          if (userAnswer === correctAnswer) {
            explanationDiv.textContent = "Correct!";
            explanationDiv.className = "correct";
            correctCount++;
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

    const score = Math.round((correctCount / questions.length) * 100);

    if (selectedCategory?.category && selectedCategory?.subConcept) {
      try {
        const res = await fetch("/api/grammarprogress", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            concept: selectedCategory.category,
            subTopic: selectedCategory.subConcept,
            score,
          }),
        });

        if (!res.ok) {
          console.error("❌ Failed to save quiz progress");
        }
      } catch (err) {
        console.error("❌ Error submitting quiz:", err);
      }
    }

    if (allCorrect) {
      alert("🎉 Congratulations! All your answers are correct!");
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

    const submitButton = document.createElement("button");
    submitButton.textContent = "Submit Answers";
    submitButton.style.padding = "10px 20px";
    submitButton.style.backgroundColor = "#0070f3";
    submitButton.style.color = "white";
    submitButton.style.border = "none";
    submitButton.style.borderRadius = "6px";
    submitButton.style.cursor = "pointer";

    form.appendChild(submitButton);

    quizContainer.appendChild(titleText);
    quizContainer.appendChild(desc);
    quizContainer.appendChild(form);
    form.addEventListener("submit", checkQuestions);
  }

  useEffect(() => {
    const tryResume = () => {
      const stored = localStorage.getItem("resumeGrammarQuiz");
      if (!stored) return;

      try {
        const { concept, subTopic } = JSON.parse(stored);
        const quiz = quizzes[concept]?.subConcepts?.find(
          (s) => s.subConcept === subTopic
        );

        if (quiz) {
          // Wait until #textContainer exists
          const containerCheck = setInterval(() => {
            const container = document.getElementById("textContainer");
            if (container) {
              generateQuestion({ ...quiz, category: concept });
              clearInterval(containerCheck);
            }
          }, 50);
        }

        localStorage.removeItem("resumeGrammarQuiz");
      } catch (err) {
        console.error("⚠️ Resume failed:", err);
      }
    };

    // Delay to ensure DOM is mounted
    setTimeout(tryResume, 50);
  }, []);



  return (
    <div id="main-content" className="grammar-layout">
      <Navbar />
      <div className="grammar-columns">
        <div id="quizList" className="grammar-sidebar">
          <h2>Sentence Structure</h2>
          <a onClick={() => generateQuestion({ ...quizzes.SentenceStructure.subConcepts[0], category: "SentenceStructure" })} className="subsection-link">Simple Sentences</a><br />
          <a onClick={() => generateQuestion({ ...quizzes.SentenceStructure.subConcepts[1], category: "SentenceStructure" })} className="subsection-link">Compound Sentences</a><br />
          <a onClick={() => generateQuestion({ ...quizzes.SentenceStructure.subConcepts[2], category: "SentenceStructure" })} className="subsection-link">Complex Sentences</a>

          <h2>Punctuation</h2>
          <a onClick={() => generateQuestion({ ...quizzes.Punctuation.subConcepts[0], category: "Punctuation" })} className="subsection-link">Commas</a><br />
          <a onClick={() => generateQuestion({ ...quizzes.Punctuation.subConcepts[1], category: "Punctuation" })} className="subsection-link">Apostrophes</a><br />
          <a onClick={() => generateQuestion({ ...quizzes.Punctuation.subConcepts[2], category: "Punctuation" })} className="subsection-link">Quotation Marks</a>

          <h2>Common Grammar Mistakes</h2>
          <a onClick={() => generateQuestion({ ...quizzes.CommonGrammarMistakes.subConcepts[0], category: "CommonGrammarMistakes" })} className="subsection-link">Subject-Verb Agreement</a><br />
          <a onClick={() => generateQuestion({ ...quizzes.CommonGrammarMistakes.subConcepts[1], category: "CommonGrammarMistakes" })} className="subsection-link">Misplaced Modifiers</a><br />
          <a onClick={() => generateQuestion({ ...quizzes.CommonGrammarMistakes.subConcepts[2], category: "CommonGrammarMistakes" })} className="subsection-link">Double Negatives</a>

          <h2>Verb Tenses</h2>
          <a onClick={() => generateQuestion({ ...quizzes.verbTenses.subConcepts[0], category: "verbTenses" })} className="subsection-link">Present Simple vs. Present Continuous</a><br />
          <a onClick={() => generateQuestion({ ...quizzes.verbTenses.subConcepts[1], category: "verbTenses" })} className="subsection-link">Past Simple vs. Past Continuous</a><br />
          <a onClick={() => generateQuestion({ ...quizzes.verbTenses.subConcepts[2], category: "verbTenses" })} className="subsection-link">Future Simple vs. Future Continuous</a>

          <h2>Word Usage</h2>
          <a onClick={() => generateQuestion({ ...quizzes.WordUsage.subConcepts[0], category: "WordUsage" })} className="subsection-link">Homophones</a><br />
          <a onClick={() => generateQuestion({ ...quizzes.WordUsage.subConcepts[1], category: "WordUsage" })} className="subsection-link">Commonly Confused Words</a><br />
          <a onClick={() => generateQuestion({ ...quizzes.WordUsage.subConcepts[2], category: "WordUsage" })} className="subsection-link">Synonyms and Antonyms</a>

          <h2>Writing Style</h2>
          <a onClick={() => generateQuestion({ ...quizzes.WritingStyle.subConcepts[0], category: "WritingStyle" })} className="subsection-link">Formal vs. Informal Writing</a><br />
          <a onClick={() => generateQuestion({ ...quizzes.WritingStyle.subConcepts[1], category: "WritingStyle" })} className="subsection-link">Active vs. Passive Voice</a><br />
          <a onClick={() => generateQuestion({ ...quizzes.WritingStyle.subConcepts[2], category: "WritingStyle" })} className="subsection-link">Concise vs. Wordy Writing</a>
        </div>

        <div id="textContainer" className="grammar-content"></div>
      </div>
    </div>
  );
}
