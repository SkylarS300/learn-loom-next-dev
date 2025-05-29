"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import "@/app/globals.css";

export default function TeacherDashboard() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [classrooms, setClassrooms] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [progressData, setProgressData] = useState([]);
  const [activeClassroomId, setActiveClassroomId] = useState(null);

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

    const result = await fetch("/api/assignments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (result.ok) {
      alert("Assignment created!");
      form.reset();
      fetchClassroomsWithAssignments(teacherId);
    } else {
      const text = await result.text();
      alert(`Failed: ${text}`);
    }
  }

  async function handleViewProgress(classroomId) {
    setProgressData([]); // 🔧 Clear old data
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

  const groupedByStudent = progressData.reduce((acc, entry) => {
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

        <form onSubmit={handleCreateClassroom}>
          <h3>Create a New Classroom</h3>
          <input name="classroomName" placeholder="Classroom Name" required className="input" />
          <button type="submit" className="cta-button">Create Classroom</button>
        </form>

        <div className="divider"></div>

        <form onSubmit={handleCreateAssignment}>
          <h3>Create Assignment</h3>
          <select name="classroomId" required className="input">
            <option value="">Select Classroom</option>
            {classrooms.map((cls) => (
              <option key={cls.id} value={cls.id}>{cls.name}</option>
            ))}
          </select>
          <input name="title" placeholder="Assignment Title" required className="input" />
          <textarea name="description" placeholder="Description" required className="input"></textarea>
          <select name="type" required className="input">
            <option value="READING">Reading</option>
            <option value="QUIZ">Grammar Quiz</option>
            <option value="UPLOAD">Upload Work</option>
          </select>
          <input name="dueDate" type="date" className="input" />
          <button type="submit" className="cta-button">Assign</button>
        </form>

        <div className="divider"></div>

        <div>
          <h3>View Student Progress</h3>
          {classrooms.map((cls) => (
            <div key={cls.id} className="classroom-card">
              <button onClick={() => handleViewProgress(cls.id)} className="cta-button">
                View Progress for {cls.name}
              </button>
            </div>
          ))}

          {activeClassroomId && (
            <div>
              <h4>Progress for Classroom ID: {activeClassroomId}</h4>
              {Object.entries(groupedByStudent).map(([key, student], i) => (
                <details key={i} style={{ marginBottom: "1rem" }}>
                  <summary style={{ cursor: "pointer", fontWeight: "bold" }}>{student.studentName}</summary>
                  <ul style={{ marginTop: "0.5rem", paddingLeft: "1rem" }}>
                    {student.assignments.map((a, j) => {
                      const icon = a.type === "READING" ? "📖" : a.type === "QUIZ" ? "🧪" : "⬆️";
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
