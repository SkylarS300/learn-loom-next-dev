"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function TeacherDashboard() {
  const router = useRouter();
  const [classrooms, setClassrooms] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  async function fetchClassrooms() {
    const teacherId = localStorage.getItem("userId");
    const res = await fetch(`/api/assignments?teacherId=${teacherId}`);
    if (res.ok) {
      const data = await res.json();
      setClassrooms(data);
    }
    setIsLoading(false);
  }

  useEffect(() => {
    const role = localStorage.getItem("role");
    const teacherId = localStorage.getItem("userId");

    if (!teacherId || role !== "TEACHER") {
      router.push("/auth");
      return;
    }

    fetchClassrooms();
  }, []);

  async function handleCreateClassroom(e) {
    e.preventDefault();
    const form = e.target;
    const name = form.classroomName.value.trim();
    const teacherId = localStorage.getItem("userId");

    const res = await fetch("/api/classrooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, teacherId: Number(teacherId) }),
    });

    if (res.ok) {
      alert("Classroom created!");
      form.reset();
      fetchClassrooms(); // ✅ Refresh list with assignments
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
      fetchClassrooms(); // ✅ Refresh list with new assignment
    } else {
      const text = await result.text();
      alert(`Failed: ${text}`);
    }
  }

  if (isLoading) return <p>Loading...</p>;

  return (
    <div>
      <header className="dashboard-header">
        <h2 className="logo">LearnLoom</h2>
        <span className="header-title">Teacher Dashboard</span>
        <button
          className="logout-button"
          onClick={() => {
            localStorage.clear();
            router.push("/auth");
          }}
        >
          Logout
        </button>
      </header>

      <div className="dashboard-wrapper">
        <h1>Welcome, Teacher!</h1>
        <p>You can manage classrooms, assign readings, and track progress here.</p>

        <section className="create-classroom">
          <h3>Create New Classroom</h3>
          <form onSubmit={handleCreateClassroom}>
            <input
              type="text"
              name="classroomName"
              placeholder="Classroom Name"
              className="input"
              required
            />
            <button type="submit" className="cta-button">
              Create Classroom
            </button>
          </form>
        </section>

        <form onSubmit={handleCreateAssignment}>
          <input
            type="text"
            name="title"
            placeholder="Assignment Title"
            className="input"
            required
          />
          <textarea
            name="description"
            placeholder="Description (optional)"
            className="input"
          />
          <select name="type" className="input" required>
            <option value="">Select Type</option>
            <option value="BOOK">Book</option>
            <option value="QUIZ">Grammar Quiz</option>
            <option value="UPLOAD">Uploaded Text</option>
          </select>
          <input type="date" name="dueDate" className="input" />

          <select name="classroomId" className="input" required>
            <option value="">Select Classroom</option>
            {classrooms.map((cls) => (
              <option key={cls.id} value={cls.id}>
                {cls.name} — {cls.code}
              </option>
            ))}
          </select>

          <button type="submit" className="cta-button">Assign</button>
        </form>

        <hr className="divider" />

        <section className="your-classes">
          <h3>Your Classrooms + Assignments</h3>
          {classrooms.length === 0 ? (
            <p>No classrooms yet.</p>
          ) : (
            <ul className="classroom-list">
              {classrooms.map((cls) => (
                <li key={cls.id} className="classroom-card">
                  <strong>{cls.name}</strong> — Code: <code>{cls.code}</code>
                  {!cls.assignments || cls.assignments.length === 0 ? (
                    <p style={{ marginTop: "4px" }}>No assignments yet.</p>
                  ) : (
                    <ul className="assignment-sublist">
                      {cls.assignments.map((a) => (
                        <li key={a.id}>
                          <strong>[{a.type}]</strong> {a.title}
                          {a.dueDate && (
                            <span> | Due: {new Date(a.dueDate).toLocaleDateString()}</span>
                          )}
                        </li>
                      ))}
                    </ul>
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
