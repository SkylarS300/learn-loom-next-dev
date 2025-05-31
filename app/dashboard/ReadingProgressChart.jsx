"use client";
import { useEffect, useState } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import books from "/src/content/book-content.js";

const COLORS = ["#00C49F", "#FF8042"]; // read, unread

export default function ReadingProgressChart() {
  const [progress, setProgress] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/readingprogress")
      .then((res) => res.json())
      .then(setProgress)
      .catch(() => setProgress([]))
      .finally(() => setLoading(false));
  }, []);

  const chapterMap = new Map();
  progress.forEach(({ bookIndex, chapterIndex }) => {
    if (!chapterMap.has(bookIndex)) chapterMap.set(bookIndex, new Set());
    chapterMap.get(bookIndex).add(chapterIndex);
  });

  if (loading) return <p>📊 Loading reading chart...</p>;

  return (
    <section className="dashboard-section">
      <h3>📖 Reading Progress by Book</h3>

      {books.map((book, index) => {
        const chaptersRead = chapterMap.get(index)?.size || 0;
        const totalChapters = book.chapters.length;

        const data = [
          { name: "Read", value: chaptersRead },
          { name: "Unread", value: totalChapters - chaptersRead },
        ];

        return (
          <div key={index} style={{ marginBottom: "2rem" }}>
            <h4>{book.title}</h4>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  outerRadius={70}
                  label={({ name, percent }) =>
                    `${name}: ${(percent * 100).toFixed(0)}%`
                  }
                >
                  {data.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        );
      })}
    </section>
  );
}
