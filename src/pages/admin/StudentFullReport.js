import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { getStudentReportProfile } from "../../lib/queries/students";
import { StudentInformation, ParentInformation, ClassTeacherInformation, FeesDetailed } from "../../components/ReportSections";
import { display } from "../../lib/feeCalc";
import { getSubjectAttendanceBreakdown, getAllMarksBreakdown } from "../../lib/queries/academicReport";
import { listMyFeeStatus } from "../../lib/queries/fees";
import { listMyLeaveRequests } from "../../lib/queries/leave";
import { listMyDocuments } from "../../lib/storage";

function initials(name) {
  return (name || "?")
    .split(" ")
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

function StudentFullReport() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const { student, profile, parent, parentLinked, classTeacher } = await getStudentReportProfile(id);
        const [attendance, marks, fees, leave, documents] = await Promise.all([
          getSubjectAttendanceBreakdown(id),
          getAllMarksBreakdown(id),
          student.class_id ? listMyFeeStatus(id, student.class_id) : Promise.resolve([]),
          listMyLeaveRequests(id),
          listMyDocuments(id).catch(() => []),
        ]);
        setData({ student, profile, parent, parentLinked, classTeacher, attendance, marks, fees, leave, documents });
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) return <p className="lede page">Loading full report…</p>;
  if (error) return <p className="form-error page">{error}</p>;
  if (!data) return null;

  const { student, profile, parent, parentLinked, classTeacher, attendance, marks, fees, leave, documents } = data;

  return (
    <div className="page details-page">
      <Link className="text-link" to={`/students/${id}`}>
        ← Back to student
      </Link>

      <div className="profile-header">
        <span className="profile-avatar">{initials(profile?.full_name)}</span>
        <div>
          <p className="eyebrow">Full report</p>
          <h1>{display(profile?.full_name)}</h1>
          <p className="lede">
            {student.classes ? `${student.classes.name}-${student.classes.section}` : "Unassigned"} · Roll no. {student.roll_no || "—"}
            {parent ? ` · Parent: ${display(parent.full_name)}` : " · No parent linked"}
          </p>
        </div>
      </div>

      <StudentInformation profile={profile} student={student} />
      <ParentInformation parent={parent} linked={parentLinked} />
      <ClassTeacherInformation classTeacher={classTeacher} hasClass={Boolean(student.class_id)} />

      <div className="panel" style={{ marginBottom: "16px" }}>
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Attendance</p>
            <h2>By subject</h2>
          </div>
        </div>
        {attendance.length === 0 ? (
          <p className="lede" style={{ padding: "16px 26px" }}>No attendance recorded.</p>
        ) : (
          attendance.map((a) => (
            <div className="recent-row" key={a.subject}>
              <span className="student-summary">
                <strong>{a.subject}</strong>
                <small>{a.present} present · {a.absent} absent · {a.late} late · {a.total} total sessions</small>
              </span>
              <span className={`status ${a.percentage >= 75 ? "status-active" : "status-leave"}`}>
                <span className="dot"></span>
                {a.percentage}%
              </span>
            </div>
          ))
        )}
      </div>

      <div className="panel" style={{ marginBottom: "16px" }}>
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Marks</p>
            <h2>Every test</h2>
          </div>
        </div>
        {marks.length === 0 ? (
          <p className="lede" style={{ padding: "16px 26px" }}>No marks entered.</p>
        ) : (
          marks.map((m, i) => (
            <div className="recent-row" key={i}>
              <span className="student-summary">
                <strong>{m.subject} — {m.exam}</strong>
                <small>{display(m.term)} · Teacher: {display(m.teacher)}</small>
              </span>
              <span className="course-cell">
                <strong>{m.marksObtained}/{m.maxMarks}</strong>
                <small>{m.percentage}%</small>
              </span>
            </div>
          ))
        )}
      </div>

      <FeesDetailed fees={fees} />

      <div className="panel" style={{ marginBottom: "16px" }}>
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Leave requests</p>
          </div>
        </div>
        {leave.length === 0 ? (
          <p className="lede" style={{ padding: "16px 26px" }}>None submitted.</p>
        ) : (
          leave.map((l) => (
            <div className="recent-row" key={l.id}>
              <span className="student-summary">
                <strong>{l.from_date} → {l.to_date}</strong>
                <small>{display(l.reason)}</small>
              </span>
              <span className={`status ${l.status === "approved" ? "status-active" : "status-leave"}`}>
                <span className="dot"></span>
                {l.status}
              </span>
            </div>
          ))
        )}
      </div>

      <div className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Documents</p>
          </div>
        </div>
        {documents.length === 0 ? (
          <p className="lede" style={{ padding: "16px 26px" }}>No documents uploaded.</p>
        ) : (
          documents.map((f) => (
            <div className="recent-row" key={f.path}>
              <span className="student-summary">
                <strong>{f.displayName || f.name}</strong>
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default StudentFullReport;
