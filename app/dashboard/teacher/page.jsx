"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import books from "/src/content/book-content.js"
import Link from "next/link";
import "@/app/globals.css";

export default function TeacherDashboard() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [classrooms, setClassrooms] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedType, setSelectedType] = useState("ALL");
  const [selectedStatus, setSelectedStatus] = useState("ALL");
  const [progressData, setProgressData] = useState([]);
  const [activeClassroomId, setActiveClassroomId] = useState(null);

  const [assignmentType, setAssignmentType] = useState("BOOK");
  const [bookIndex, setBookIndex] = useState(null);
  const [chapterIndex, setChapterIndex] = useState(null);

  const teacherId = session?.user?.id;
  const role = session?.user?.role;

  useEffect(() => {
    if (status === "loading") return;
    if (!teacherId || role !== "TEACHER") {
      router.push("/auth");
      return;
    }
    fetchClassroomsWithAssignments(teacherId);
  }, [status]);

  async function fetchClassroomsWithAssignments(teacherId) {
    const res = await fetch(`/api/classrooms?teacherId=${teacherId}`);
    if (res.ok) {
      const data = await res.json();
      setClassrooms(data);
    }
    setIsLoading(false);
  }

  async function handleCreateClassroom(e) {
    e.preventDefault();
    const form = e.target;
    const name = form.classroomName.value.trim();

    const res = await fetch("/api/classrooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, teacherId: Number(teacherId) }),
    });

    if (res.ok) {
      alert("Classroom created!");
      form.reset();
      fetchClassroomsWithAssignments(teacherId);
    } else {
      const text = await res.text();
      alert(`Failed: ${text}`);
    }
  }

  async function handleCreateAssignment(e) {
    e.preventDefault();
    const form = e.target;
    const classroomId = form.classroomId.value;

    if (!classroomId) {
      alert("Please select a classroom.");
      return;
    }

    const payload = {
      title: form.title.value.trim(),
      description: form.description.value.trim(),
      type: form.type.value,
      dueDate: form.dueDate.value || null,
      classroomId: Number(classroomId),
    };

    if (payload.type === "BOOK") {
      if (bookIndex === null || chapterIndex === null) {
        alert("Please select a book and chapter.");
        return;
      }
      payload.bookIndex = parseInt(bookIndex);
      payload.chapterIndex = parseInt(chapterIndex);
    }

    const result = await fetch("/api/assignments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (result.ok) {
      alert("Assignment created!");
      form.reset();
      setBookIndex(null);
      setChapterIndex(null);
      fetchClassroomsWithAssignments(teacherId);
    } else {
      const text = await result.text();
      alert(`Failed: ${text}`);
    }
  }

  async function handleViewProgress(classroomId) {
    if (activeClassroomId === classroomId) {
      // If already active, toggle closed
      setActiveClassroomId(null);
      setProgressData([]);
      return;
    }

    const res = await fetch(`/api/completions/mark?classroomId=${classroomId}`);
    if (res.ok) {
      const data = await res.json();
      setProgressData(data);
      setActiveClassroomId(classroomId);
    } else {
      alert("Failed to fetch classroom progress.");
    }
  }


  function handleLogout() {
    signOut({ callbackUrl: "/auth" });
  }

  const filteredData = progressData.filter((entry) => {
    const typeMatch = selectedType === "ALL" || entry.assignmentType === selectedType;
    const statusMatch =
      selectedStatus === "ALL" ||
      (selectedStatus === "COMPLETED" && entry.completed) ||
      (selectedStatus === "INCOMPLETE" && !entry.completed);
    return typeMatch && statusMatch;
  });

  const groupedByStudent = filteredData.reduce((acc, entry) => {
    const key = entry.userId || "unknown";
    if (!acc[key]) {
      acc[key] = {
        studentName: entry.studentName || key,
        assignments: [],
      };
    }
    acc[key].assignments.push({
      assignmentTitle: entry.assignmentTitle,
      completed: entry.completed,
      completedAt: entry.completedAt,
      quizScore: entry.quizScore,
      type: entry.assignmentType,
    });
    return acc;
  }, {});

  if (isLoading || status === "loading") return <p>Loading...</p>;

  return (
    <div>
      <header className="dashboard-header">
        <h2 className="logo">LearnLoom</h2>
        <span className="header-title">Teacher Dashboard</span>
        <nav>
          <Link href="/library">Library</Link> |{" "}
          <Link href="/readingpal">Reading Pal</Link> |{" "}
          <Link href="/grammar">Grammar</Link>
        </nav>
        <button className="logout-button" onClick={handleLogout}>Logout</button>
      </header>

      <div className="dashboard-wrapper">
        <h1>Welcome, Teacher!</h1>
        <p>You can manage classrooms, assign readings, and track progress here.</p>

        <form onSubmit={handleCreateClassroom} style={{ marginBottom: "2rem" }}>
          <h3>Create a New Classroom</h3>
          <input name="classroomName" placeholder="Classroom Name" required className="input" />
          <button type="submit" className="cta-button">Create Classroom</button>
        </form>

        <form onSubmit={handleCreateAssignment} style={{ marginBottom: "2rem" }}>
          <h3>Create Assignment</h3>
          <select name="classroomId" required className="input">
            <option value="">Select Classroom</option>
            {classrooms.map((cls) => (
              <option key={cls.id} value={cls.id}>{cls.name} — Code: {cls.code}</option>
            ))}
          </select>
          <input name="title" placeholder="Assignment Title" required className="input" />
          <textarea name="description" placeholder="Description" required className="input"></textarea>
          <select name="type" required className="input" value={assignmentType} onChange={(e) => setAssignmentType(e.target.value)}>
            <option value="BOOK">Reading</option>
            <option value="QUIZ">Grammar Quiz</option>
            <option value="UPLOAD">Upload Work</option>
          </select>

          {assignmentType === "BOOK" && (
            <>
              <label>Select Book:</label>
              <select
                value={bookIndex ?? ""}
                onChange={(e) => {
                  setBookIndex(e.target.value);
                  setChapterIndex(null);
                }}
                className="input"
              >
                <option value="" disabled>Select a book</option>
                {books.map((book, index) => (
                  <option key={index} value={index}>{book.title}</option>
                ))}
              </select>

              {bookIndex !== null && (
                <>
                  <label>Select Chapter:</label>
                  <select
                    value={chapterIndex ?? ""}
                    onChange={(e) => setChapterIndex(parseInt(e.target.value))}
                    className="input"
                  >
                    <option value="" disabled>Select a chapter</option>
                    {books[bookIndex]?.chapters.map((chapter, idx) => (
                      <option key={idx} value={idx}>{chapter.chapterTitle}</option>
                    ))}
                  </select>
                </>
              )}
            </>
          )}

          <input name="dueDate" type="date" className="input" />
          <button type="submit" className="cta-button">Assign</button>
        </form>

        <div>
          <h3>View Student Progress</h3>
          {classrooms.map((cls) => (
            <div key={cls.id} className="classroom-card">
              <p><strong>{cls.name}</strong> — <code>Code: {cls.code}</code></p>
              <button onClick={() => handleViewProgress(cls.id)} className="cta-button">
                View Progress
              </button>
            </div>
          ))}

          {activeClassroomId && (
            <div style={{ marginTop: "1rem" }}>
              <h4>Progress for {classrooms.find(c => c.id === activeClassroomId)?.name}</h4>
              <div className="progress-filter-bar">
                <label>
                  Type:
                  <select value={selectedType} onChange={(e) => setSelectedType(e.target.value)}>
                    <option value="ALL">All</option>
                    <option value="BOOK">Reading</option>
                    <option value="QUIZ">Grammar Quiz</option>
                    <option value="UPLOAD">Upload</option>
                  </select>
                </label>

                <label>
                  Completion:
                  <select value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)}>
                    <option value="ALL">All</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="INCOMPLETE">Not Completed</option>
                  </select>
                </label>
              </div>

              {Object.entries(groupedByStudent).map(([key, student], i) => (
                <details key={i} style={{ marginBottom: "1rem" }}>
                  <summary className="student-summary">{student.studentName}</summary>
                  <ul style={{ marginTop: "0.5rem", paddingLeft: "1rem" }}>
                    {student.assignments.map((a, j) => {
                      const icon = a.type === "BOOK" ? "📖" : a.type === "QUIZ" ? "🧪" : "⬆️";
                      const date = a.completedAt ? new Date(a.completedAt).toLocaleDateString() : "—";
                      const score = a.quizScore !== undefined && a.quizScore !== null ? `Score: ${a.quizScore}%` : "";
                      return (
                        <li key={j}>
                          {icon} <strong>{a.assignmentTitle}</strong> — {a.completed ? "✅ Done" : "❌ Not done"} {score && `• ${score}`} • {date}
                        </li>
                      );
                    })}
                  </ul>
                </details>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}