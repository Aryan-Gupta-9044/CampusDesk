import React, { useEffect, useState } from "react";

import { useAuth } from "../../context/AuthContext";
import RoleStamp from "../../components/RoleStamp";
import ModuleCard from "../../components/ModuleCard";
import StudentAnalyticsSection from "../../components/analytics/StudentAnalyticsSection";
import { getStudentIdForParent } from "../../lib/queries/me";

function ParentDashboard() {
  const { profile, user } = useAuth();
  const [linkedStudentId, setLinkedStudentId] = useState(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    getStudentIdForParent(user.id)
      .then(setLinkedStudentId)
      .finally(() => setChecked(true));
  }, [user]);

  return (
    <div className="page dashboard">
      <section className="welcome-row">
        <div>
          <p className="eyebrow">Parent portal</p>
          <h1>Welcome, {profile?.full_name || "Parent"}.</h1>
          <p className="lede">A read-only view of your child's academic record.</p>
        </div>
        <RoleStamp role="parent" size="lg" />
      </section>

      {checked && !linkedStudentId ? (
        <p className="lede" style={{ marginBottom: "20px" }}>
          Not linked to your child's account yet. Ask your school's administrator to set the link.
        </p>
      ) : (
        <StudentAnalyticsSection studentId={linkedStudentId} />
      )}

      <section className="module-grid" aria-label="Parent modules">
        <ModuleCard title="Child's attendance" description="Attendance record for your linked child." to="/attendance" accent="accent-green" />
        <ModuleCard title="Child's marks & results" description="Published exam results and grades." to="/results" accent="accent-green" />
        <ModuleCard title="Fee status" description="Amounts due and payment history for your child." to="/fees" accent="accent-yellow" />
        <ModuleCard title="Notices" description="Announcements for your child's class." to="/notices" accent="accent-yellow" />
        <ModuleCard title="Events" description="Academic calendar." to="/events" accent="accent-yellow" />
        <ModuleCard title="Timetable" description="Your child's weekly class schedule." to="/timetable" accent="accent-blue" />
        <ModuleCard title="My documents" description="Upload and manage your own files." to="/documents" accent="accent-yellow" />
        <ModuleCard title="Chat with a teacher" description="Ask a quick question about your child." to="/chat" accent="accent-blue" />
        <ModuleCard title="Academic report" description="Cumulative attendance and marks, by subject." to="/report" accent="accent-green" />
      </section>
    </div>
  );
}

export default ParentDashboard;
