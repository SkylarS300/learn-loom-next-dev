"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";

export default function StudentDashboard() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [joinCode, setJoinCode] = useState("");
  const [classrooms, setClassrooms] = useState([]);
  const [assignments, setAssignments] = useState([]);

  const userId = session?.user?.id;
  const role = session?.user?.role;

  useEffect(() => {
    if (status === "loading") return;

    if (!userId || role !== "STUDENT") {
      router.push("/login");
    } else {
      fetchStudentClassrooms(userId);
      fetchStudentAssignments(userId);
    }
  }, [status]);

  async function fetchStudentClassrooms(userId) {
    const res = await fetch(`/api/studentClassrooms?studentId=${userId}`);
    if (res.ok) {
      const data = await res.json();

      const unique = data.filter(
        (cls, index, self) => index === self.findIndex(c => c.id === cls.id)
      );

      setClassrooms(unique);
    }
  }

  async function fetchStudentAssignments(userId) {
    const res = await fetch(`/api/studentAssignments?studentId=${userId}`);
    if (res.ok) {
      const data = await res.json();
      setAssignments(data);
    }
  }

  async function handleJoinClassroom() {
    const trimmedCode = joinCode.trim();
    if (!trimmedCode || !userId) return;

    const res = await fetch("/api/studentClassrooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: trimmedCode, studentId: Number(userId) }),
    });

    if (res.ok) {
      const newClassroom = await res.json();

      setClassrooms((prev) => {
        const alreadyExists = prev.some((c) => c.id === newClassroom.id);
        return alreadyExists ? prev : [...prev, newClassroom];
      });

      setJoinCode("");
      fetchStudentAssignments(userId);
      alert(`Joined "${newClassroom.name}" successfully.`);
    } else if (res.status === 409) {
      alert("You're already in that classroom.");
    } else if (res.status === 404) {
      alert("No classroom found with that code.");
    } else {
      const errorText = await res.text();
      alert(`Failed to join classroom: ${errorText}`);
    }
  }

  async function handleMarkComplete(assignmentId) {
    const res = await fetch("/api/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignmentId, studentId: userId }),
    });

    if (res.ok) {
      fetchStudentAssignments(userId);
    } else {
      alert("Failed to mark as complete.");
    }
  }

  function handleLogout() {
    signOut({ callbackUrl: "/login" });
  }

  if (status === "loading") return <p>Loading...</p>;

  return (
    <div>
      <header className="dashboard-header">
        <h2 className="logo">LearnLoom</h2>
        <span className="header-title">Student Dashboard</span>
        <button className="logout-button" onClick={handleLogout}>Logout</button>
      </header>

      <div className="dashboard-wrapper">
        <h1>Welcome, Student!</h1>
        <p>Enter a code to join your classroom.</p>

        <section className="join-classroom">
          <input
            type="text"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            placeholder="Enter Classroom Code"
            className="input"
          />
          <button className="cta-button" onClick={handleJoinClassroom}>
            Join
          </button>
        </section>

        <hr className="divider" />

        <section className="my-classes">
          <h3>Your Classrooms</h3>
          <ul className="classroom-list">
            {classrooms.map((cls) => (
              <li key={`${cls.id}-${cls.code}`} className="classroom-card">
                {cls.name} — <code>{cls.code}</code>
              </li>
            ))}
          </ul>
        </section>

        <hr className="divider" />

        <section className="my-assignments">
          <h3>Your Assignments</h3>
          {assignments.length === 0 ? (
            <p>No assignments yet.</p>
          ) : (
            <ul className="assignment-list">
              {assignments.map((a) => (
                <li key={a.id} className="assignment-card">
                  <strong>{a.title}</strong> — {a.type}
                  {a.dueDate && (
                    <span> | Due: {new Date(a.dueDate).toLocaleDateString()}</span>
                  )}
                  <br />
                  {a.completedAt ? (
                    <span style={{ color: "green" }}>✅ Completed</span>
                  ) : (
                    <button
                      className="cta-button small"
                      onClick={() => handleMarkComplete(a.id)}
                    >
                      Mark as Complete
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
