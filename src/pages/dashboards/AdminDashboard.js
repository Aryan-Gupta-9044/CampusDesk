import React from "react";

import { useAuth } from "../../context/AuthContext";
import RoleStamp from "../../components/RoleStamp";
import ModuleCard from "../../components/ModuleCard";
import AdminAnalyticsSection from "../../components/analytics/AdminAnalyticsSection";

function AdminDashboard() {
  const { profile } = useAuth();

  return (
    <div className="page dashboard">
      <section className="welcome-row">
        <div>
          <p className="eyebrow">Admin console</p>
          <h1>Welcome, {profile?.full_name || "Admin"}.</h1>
          <p className="lede">Full institution oversight — users, academics, and records.</p>
        </div>
        <RoleStamp role="admin" size="lg" />
      </section>

      <AdminAnalyticsSection />

      <section className="module-grid" aria-label="Admin modules">
        <ModuleCard title="Students" description="Add, edit, and suspend student records." to="/students" accent="accent-coral" />
        <ModuleCard title="Teachers" description="Add, edit, and suspend faculty accounts." to="/teachers" accent="accent-blue" />
        <ModuleCard
          title="Classes & subjects"
          description="Define classes, sections, subjects, and teacher assignments."
          to="/classes"
          accent="accent-blue"
        />
        <ModuleCard
          title="Attendance"
          description="Institution-wide attendance oversight."
          to="/attendance"
          accent="accent-green"
        />
        <ModuleCard
          title="Exams & results"
          description="Create exams, then compute and publish results."
          to="/results"
          accent="accent-green"
        />
        <ModuleCard title="Fees" description="Fee structures and manually tracked payments." to="/fees" accent="accent-yellow" />
        <ModuleCard title="Notices" description="Post announcements across the institution." to="/notices" accent="accent-yellow" />
        <ModuleCard title="Events" description="Manage the academic calendar." to="/events" accent="accent-yellow" />
        <ModuleCard
          title="Leave requests"
          description="Review and approve leave across the institution."
          to="/leave"
          accent="accent-coral"
        />
        <ModuleCard
          title="Audit log"
          description="A record of suspensions, approvals, and published results."
          to="/audit-log"
          accent="accent-coral"
        />
        <ModuleCard title="Timetable" description="Build a weekly schedule per class." to="/timetable" accent="accent-blue" />
        <ModuleCard title="My documents" description="Files you've uploaded for your own account." to="/documents" accent="accent-yellow" />
      </section>
    </div>
  );
}

export default AdminDashboard;
