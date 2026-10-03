import React, { useEffect, useState } from "react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";

import { getStudentAttendanceSummary, getStudentResultsTrend, getStudentFeeSummary } from "../../lib/queries/analytics";
import { getSubjectAttendanceBreakdown, getAllMarksBreakdown } from "../../lib/queries/academicReport";
import { getStudent } from "../../lib/queries/students";

const COLORS = { present: "#4e9a73", absent: "#e96d5e", late: "#e7b84f", leave: "#6396b4" };

function StudentAnalyticsSection({ studentId }) {
  const [attendance, setAttendance] = useState(null);
  const [results, setResults] = useState([]);
  const [fees, setFees] = useState(null);
  const [subjectAttendance, setSubjectAttendance] = useState([]);
  const [subjectMarks, setSubjectMarks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!studentId) return;
    (async () => {
      try {
        const student = await getStudent(studentId);
        const [att, res, fee, subAtt, marks] = await Promise.all([
          getStudentAttendanceSummary(studentId),
          getStudentResultsTrend(studentId),
          getStudentFeeSummary(studentId, student.class_id),
          getSubjectAttendanceBreakdown(studentId),
          getAllMarksBreakdown(studentId),
        ]);
        setAttendance(att);
        setResults(res);
        setFees(fee);
        setSubjectAttendance(subAtt);

        const bySubject = {};
        marks.forEach((m) => {
          if (!bySubject[m.subject]) bySubject[m.subject] = { total: 0, count: 0 };
          bySubject[m.subject].total += m.percentage;
          bySubject[m.subject].count += 1;
        });
        setSubjectMarks(
          Object.entries(bySubject).map(([subject, v]) => ({ subject, avgPercentage: Math.round(v.total / v.count) }))
        );
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [studentId]);

  if (loading) return <p className="lede">Loading your analytics…</p>;
  if (error) return <p className="form-error">{error}</p>;

  const pieData = attendance
    ? Object.entries(attendance.counts)
        .filter(([, v]) => v > 0)
        .map(([status, value]) => ({ name: status, value }))
    : [];

  const marksData = results.map((r, i) => ({ name: r.exams?.name || `Exam ${i + 1}`, percentage: r.percentage }));

  return (
    <>
      <div className="detail-grid">
        <div className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Attendance</p>
              <h2>{attendance?.percentage ?? 0}% present</h2>
            </div>
          </div>
          {pieData.length === 0 ? (
            <p className="lede" style={{ padding: "20px 26px" }}>
              No attendance recorded yet.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                  {pieData.map((entry) => (
                    <Cell key={entry.name} fill={COLORS[entry.name] || "#999"} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Results</p>
              <h2>Exam performance</h2>
            </div>
          </div>
          {marksData.length === 0 ? (
            <p className="lede" style={{ padding: "20px 26px" }}>
              No published results yet.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={marksData}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="percentage" fill="#e96d5e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="detail-grid" style={{ marginTop: "16px" }}>
        <div className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Attendance</p>
              <h2>By subject</h2>
            </div>
          </div>
          {subjectAttendance.length === 0 ? (
            <p className="lede" style={{ padding: "20px 26px" }}>
              No attendance recorded yet.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(180, subjectAttendance.length * 45)}>
              <BarChart data={subjectAttendance} layout="vertical" margin={{ left: 20 }}>
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="subject" width={90} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="percentage" fill="#4e9a73" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Marks</p>
              <h2>Average by subject</h2>
            </div>
          </div>
          {subjectMarks.length === 0 ? (
            <p className="lede" style={{ padding: "20px 26px" }}>
              No marks entered yet.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(180, subjectMarks.length * 45)}>
              <BarChart data={subjectMarks} layout="vertical" margin={{ left: 20 }}>
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="subject" width={90} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="avgPercentage" fill="#e96d5e" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="module-grid" style={{ marginTop: "16px", marginBottom: "24px" }}>
        <div className="module-card accent-yellow">
          <div className="module-card-top">
            <h3>Total due</h3>
          </div>
          <p style={{ fontSize: "22px", color: "#1d3547" }}>₹{fees?.totalDue ?? 0}</p>
        </div>
        <div className="module-card accent-green">
          <div className="module-card-top">
            <h3>Paid so far</h3>
          </div>
          <p style={{ fontSize: "22px", color: "#1d3547" }}>₹{fees?.totalPaid ?? 0}</p>
        </div>
        <div className="module-card accent-coral">
          <div className="module-card-top">
            <h3>Remaining</h3>
          </div>
          <p style={{ fontSize: "22px", color: "#1d3547" }}>₹{fees?.remaining ?? 0}</p>
        </div>
      </div>
    </>
  );
}

export default StudentAnalyticsSection;
