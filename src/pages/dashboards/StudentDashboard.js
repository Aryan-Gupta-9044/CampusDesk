import React from "react";

import { useAuth } from "../../context/AuthContext";
import RoleStamp from "../../components/RoleStamp";
import ModuleCard from "../../components/ModuleCard";
import StudentAnalyticsSection from "../../components/analytics/StudentAnalyticsSection";

function StudentDashboard() {
  const { profile, user } = useAuth();

  return (
    <div className="page dashboard">
      <section className="welcome-row">
        <div>
          <p className="eyebrow">Student portal</p>
          <h1>Welcome, {profile?.full_name || "Student"}.</h1>
          <p className="lede">Your attendance, marks, fees, and notices.</p>
        </div>
        <RoleStamp role="student" size="lg" />
      </section>

      <StudentAnalyticsSection studentId={user.id} />

      <section className="module-grid" aria-label="Student modules">
        <ModuleCard title="My attendance" description="Day-by-day and subject-wise attendance record." to="/attendance" accent="accent-green" />
        <ModuleCard title="My marks & results" description="Published exam results and grades." to="/results" accent="accent-green" />
        <ModuleCard title="Fee status" description="Amounts due and payment history." to="/fees" accent="accent-yellow" />
        <ModuleCard title="Notices" description="Announcements for your class." to="/notices" accent="accent-yellow" />
        <ModuleCard title="Events" description="Academic calendar." to="/events" accent="accent-yellow" />
        <ModuleCard title="Apply for leave" description="Request leave for approval by your class teacher." to="/leave" accent="accent-coral" />
        <ModuleCard title="Timetable" description="Your weekly class schedule." to="/timetable" accent="accent-blue" />
        <ModuleCard title="My documents" description="Upload and manage your own files." to="/documents" accent="accent-yellow" />
        <ModuleCard title="Chat with a teacher" description="Ask a quick question about attendance, marks, or fees." to="/chat" accent="accent-blue" />
        <ModuleCard title="Academic report" description="Cumulative attendance and marks, by subject." to="/report" accent="accent-green" />
      </section>
    </div>
  );
}

export default StudentDashboard;
