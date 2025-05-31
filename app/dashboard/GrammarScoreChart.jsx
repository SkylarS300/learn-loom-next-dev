"use client";
import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

export default function GrammarScoreChart() {
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/grammarprogress")
      .then((res) => res.json())
      .then(setQuizzes)
      .catch(() => setQuizzes([]))
      .finally(() => setLoading(false));
  }, []);

  const chartData = quizzes.map((q) => ({
    name: `${q.concept} — ${q.subTopic}`,
    score: q.score,
  }));

  if (loading) return <p>📈 Loading grammar scores...</p>;
  if (chartData.length === 0) return <p>No quiz data to chart.</p>;

  return (
    <section className="dashboard-section">
      <h3>🧪 Grammar Scores</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} margin={{ top: 20, right: 20, bottom: 40, left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" angle={-45} textAnchor="end" interval={0} height={100} />
          <YAxis domain={[0, 100]} />
          <Tooltip />
          <Bar dataKey="score" fill="#8884d8" />
        </BarChart>
      </ResponsiveContainer>
    </section>
  );
}
