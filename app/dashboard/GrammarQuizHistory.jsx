"use client";
import { useEffect, useState } from "react";

export default function GrammarQuizHistory() {
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/grammarprogress")
      .then((res) => res.json())
      .then(setQuizzes)
      .catch(() => setQuizzes([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p>🧪 Loading quiz history...</p>;

  return (
    <section className="dashboard-section">
      <h3>🧪 Grammar Quiz History</h3>

      {quizzes.length === 0 ? (
        <p style={{ color: "#666" }}>No quizzes taken yet.</p>
      ) : (
        <table className="quiz-table">
          <thead>
            <tr>
              <th>Quiz</th>
              <th>Date</th>
              <th>Score</th>
            </tr>
          </thead>
          <tbody>
            {quizzes.map((q) => (
              <tr key={q.id}>
                <td>{q.concept} — {q.subTopic}</td>
                <td>{new Date(q.createdAt).toLocaleDateString()}</td>
                <td style={{ color: q.score >= 80 ? "green" : q.score >= 50 ? "orange" : "red" }}>
                  {q.score}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div style={{ marginTop: "1rem" }}>
        <a href="/grammar" className="cta-button">
          Practice More Grammar
        </a>
      </div>
    </section>
  );
}
