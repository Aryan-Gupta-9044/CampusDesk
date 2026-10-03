import React from "react";

import { useAuth } from "../../context/AuthContext";
import RoleStamp from "../../components/RoleStamp";
import ModuleCard from "../../components/ModuleCard";
import TeacherAnalyticsSection from "../../components/analytics/TeacherAnalyticsSection";

function TeacherDashboard() {
  const { profile, user } = useAuth();

  return (
    <div className="page dashboard">
      <section className="welcome-row">
        <div>
          <p className="eyebrow">Teacher workspace</p>
          <h1>Welcome, {profile?.full_name || "Teacher"}.</h1>
          <p className="lede">Your assigned classes, attendance, and marks in one place.</p>
        </div>
        <RoleStamp role="teacher" size="lg" />
      </section>

      <TeacherAnalyticsSection teacherId={user.id} />

      <section className="module-grid" aria-label="Teacher modules">
        <ModuleCard
          title="Mark attendance"
          description="Take daily or subject-wise attendance for your classes."
          to="/attendance"
          accent="accent-green"
        />
        <ModuleCard
          title="Enter marks"
          description="Submit exam marks for the subjects you teach."
          to="/results"
          accent="accent-green"
        />
        <ModuleCard title="Post a notice" description="Send an announcement to your class." to="/notices" accent="accent-yellow" />
        <ModuleCard title="Events" description="View and add to the academic calendar." to="/events" accent="accent-yellow" />
        <ModuleCard
          title="Leave requests"
          description="Approve leave from your students, or apply for your own."
          to="/leave"
          accent="accent-coral"
        />
        <ModuleCard title="Timetable" description="Your weekly schedule across classes." to="/timetable" accent="accent-blue" />
        <ModuleCard title="My documents" description="Files you've uploaded for your own account." to="/documents" accent="accent-yellow" />
        <ModuleCard title="Student queries" description="Answer questions from students and parents." to="/chat" accent="accent-blue" />
        <ModuleCard title="Academic report" description="Cumulative attendance and per-exam averages for your classes." to="/report" accent="accent-green" />
      </section>
    </div>
  );
}

export default TeacherDashboard;
