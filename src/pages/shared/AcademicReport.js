import React, { useEffect, useState } from "react";

import { useAuth } from "../../context/AuthContext";
import { getSubjectAttendanceBreakdown, getAllMarksBreakdown, getTeacherSubjectBreakdown } from "../../lib/queries/academicReport";
import { getStudentIdForParent } from "../../lib/queries/me";
import { getStudentReportProfile } from "../../lib/queries/students";
import { listMyFeeStatus } from "../../lib/queries/fees";
import { StudentInformation, ParentInformation, ClassTeacherInformation, FeesCompact } from "../../components/ReportSections";

function StudentReport({ studentId, heading }) {
  const [attendance, setAttendance] = useState([]);
  const [marks, setMarks] = useState([]);
  const [info, setInfo] = useState(null);
  const [fees, setFees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!studentId) return;
    setLoading(true);
    setError("");
    (async () => {
      try {
        // Profile block is loaded first; each section failing on its own
        // (e.g. RLS) shows a message instead of blanking the whole report.
        const problems = [];
        const safe = async (label, fn, fallback) => {
          try {
            return await fn();
          } catch (err) {
            problems.push(`${label}: ${err.message}`);
            return fallback;
          }
        };
        const profileData = await safe("Profile", () => getStudentReportProfile(studentId), null);
        const [att, mk, feeItems] = await Promise.all([
          safe("Attendance", () => getSubjectAttendanceBreakdown(studentId), []),
          safe("Marks", () => getAllMarksBreakdown(studentId), []),
          safe(
            "Fees",
            () => (profileData?.student?.class_id ? listMyFeeStatus(studentId, profileData.student.class_id) : []),
            []
          ),
        ]);
        setInfo(profileData);
        setAttendance(att);
        setMarks(mk);
        setFees(feeItems);
        if (problems.length) setError(problems.join(" · "));
      } finally {
        setLoading(false);
      }
    })();
  }, [studentId]);

  if (loading) return <p className="lede page">Loading…</p>;

  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Academics</p>
          <h1>{heading}</h1>
          <p className="lede">Cumulative attendance and marks, broken down by subject.</p>
        </div>
      </div>

      {error && <p className="form-error">{error}</p>}

      {info && (
        <>
          <StudentInformation variant="summary" profile={info.profile} student={info.student} />
          <ClassTeacherInformation variant="summary" classTeacher={info.classTeacher} hasClass={Boolean(info.student.class_id)} />
          <ParentInformation variant="summary" parent={info.parent} linked={info.parentLinked} />
        </>
      )}

      <div className="panel" style={{ marginBottom: "20px" }}>
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Attendance</p>
            <h2>By subject</h2>
          </div>
        </div>
        {attendance.length === 0 ? (
          <p className="lede" style={{ padding: "20px 26px" }}>
            No attendance recorded yet.
          </p>
        ) : (
          attendance.map((a) => (
            <div className="recent-row" key={a.subject}>
              <span className="student-summary">
                <strong>{a.subject}</strong>
                <small>
                  {a.present} present · {a.absent} absent · {a.late} late · {a.total} total sessions
                </small>
              </span>
              <span className={`status ${a.percentage >= 75 ? "status-active" : "status-leave"}`}>
                <span className="dot"></span>
                {a.percentage}%
              </span>
            </div>
          ))
        )}
      </div>

      <div className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Marks</p>
            <h2>Every test, by subject</h2>
          </div>
        </div>
        {marks.length === 0 ? (
          <p className="lede" style={{ padding: "20px 26px" }}>
            No marks entered yet.
          </p>
        ) : (
          marks
            .sort((a, b) => a.subject.localeCompare(b.subject) || a.exam.localeCompare(b.exam))
            .map((m, i) => (
              <div className="recent-row" key={i}>
                <span className="student-summary">
                  <strong>
                    {m.subject} — {m.exam}
                  </strong>
                  <small>
                    {m.term || "—"} · Teacher: {m.teacher || "—"}
                  </small>
                </span>
                <span className="course-cell">
                  <strong>
                    {m.marksObtained}/{m.maxMarks}
                  </strong>
                  <small>{m.percentage}%</small>
                </span>
              </div>
            ))
        )}
      </div>

      <div style={{ marginTop: "20px" }}>
        <FeesCompact fees={fees} />
      </div>
    </div>
  );
}

function TeacherReport({ teacherId }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getTeacherSubjectBreakdown(teacherId)
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [teacherId]);

  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Academics</p>
          <h1>Academic report</h1>
          <p className="lede">Cumulative attendance and per-exam averages for everything you teach.</p>
        </div>
      </div>

      {error && <p className="form-error">{error}</p>}

      {loading ? (
        <p className="lede">Loading…</p>
      ) : data.length === 0 ? (
        <p className="lede">You're not assigned to any classes/subjects yet.</p>
      ) : (
        data.map((d) => (
          <div className="panel" key={d.label} style={{ marginBottom: "16px" }}>
            <div className="panel-heading">
              <div>
                <p className="eyebrow">{d.label}</p>
                <h2>{d.attendancePct}% cumulative attendance</h2>
              </div>
            </div>
            {d.examBreakdown.length === 0 ? (
              <p className="lede" style={{ padding: "20px 26px" }}>
                No marks entered yet.
              </p>
            ) : (
              d.examBreakdown.map((e) => (
                <div className="recent-row" key={e.exam}>
                  <span className="student-summary">
                    <strong>{e.exam}</strong>
                  </span>
                  <span className="course-cell">
                    <strong>{e.avgPercentage}%</strong>
                    <small>class average</small>
                  </span>
                </div>
              ))
            )}
          </div>
        ))
      )}
    </div>
  );
}

function AcademicReport() {
  const { role, user } = useAuth();
  const [linkedStudentId, setLinkedStudentId] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (role === "parent") {
      getStudentIdForParent(user.id).then(setLinkedStudentId).catch((err) => setError(err.message));
    }
  }, [role, user]);

  if (role === "student") return <StudentReport studentId={user.id} heading="My academic report" />;
  if (role === "teacher") return <TeacherReport teacherId={user.id} />;
  if (role === "parent") {
    if (error) return <p className="form-error page">{error}</p>;
    if (!linkedStudentId)
      return (
        <div className="page">
          <p className="lede">Not linked to a child's account yet. Ask your school's administrator to set the link.</p>
        </div>
      );
    return <StudentReport studentId={linkedStudentId} heading="Child's academic report" />;
  }
  return (
    <div className="page">
      <p className="lede">Not applicable to your account.</p>
    </div>
  );
}

export default AcademicReport;
