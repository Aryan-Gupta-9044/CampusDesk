import React, { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";

import { getTeacherClassSummaries } from "../../lib/queries/analytics";

function TeacherAnalyticsSection({ teacherId }) {
  const [summaries, setSummaries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!teacherId) return;
    getTeacherClassSummaries(teacherId)
      .then(setSummaries)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [teacherId]);

  if (loading) return <p className="lede">Loading your analytics…</p>;
  if (error) return <p className="form-error">{error}</p>;

  return (
    <div className="panel" style={{ marginBottom: "24px" }}>
      <div className="panel-heading">
        <div>
          <p className="eyebrow">My classes</p>
          <h2>Attendance vs average marks</h2>
        </div>
      </div>
      {summaries.length === 0 ? (
        <p className="lede" style={{ padding: "20px 26px" }}>
          You're not assigned to any classes/subjects yet.
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={Math.max(240, summaries.length * 55)}>
          <BarChart data={summaries} layout="vertical" margin={{ left: 40 }}>
            <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
            <YAxis type="category" dataKey="label" width={180} tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            <Bar dataKey="attendancePct" name="Attendance %" fill="#4e9a73" radius={[0, 4, 4, 0]} />
            <Bar dataKey="avgMarksPct" name="Avg marks %" fill="#e96d5e" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

export default TeacherAnalyticsSection;
