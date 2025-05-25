"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import '@/app/globals.css';

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
      router.push("/login");
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
    signOut({ callbackUrl: "/login" });
  }

  if (isLoading || status === "loading") return <p>Loading...</p>;

  return (
    <div>
      <header className="dashboard-header">
        <h2 className="logo">LearnLoom</h2>
        <span className="header-title">Teacher Dashboard</span>
        <button className="logout-button" onClick={handleLogout}>Logout</button>
      </header>

      <div className="dashboard-wrapper">
        <h1>Welcome, Teacher!</h1>
        <p>You can manage classrooms, assign readings, and track progress here.</p>

        {/* The rest of your component stays unchanged */}
      </div>
    </div>
  );
}
