import React, { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";

import { getInstitutionOverview } from "../../lib/queries/analytics";

function AdminAnalyticsSection() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getInstitutionOverview()
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="lede">Loading institution analytics…</p>;
  if (error) return <p className="form-error">{error}</p>;

  return (
    <>
      <div className="module-grid" style={{ marginBottom: "16px" }}>
        <div className="module-card accent-coral">
          <div className="module-card-top">
            <h3>Students</h3>
          </div>
          <p style={{ fontSize: "22px", color: "#1d3547" }}>{data?.studentCount}</p>
        </div>
        <div className="module-card accent-blue">
          <div className="module-card-top">
            <h3>Teachers</h3>
          </div>
          <p style={{ fontSize: "22px", color: "#1d3547" }}>{data?.teacherCount}</p>
        </div>
        <div className="module-card accent-blue">
          <div className="module-card-top">
            <h3>Classes</h3>
          </div>
          <p style={{ fontSize: "22px", color: "#1d3547" }}>{data?.classCount}</p>
        </div>
        <div className="module-card accent-green">
          <div className="module-card-top">
            <h3>Overall attendance</h3>
          </div>
          <p style={{ fontSize: "22px", color: "#1d3547" }}>{data?.overallAttendancePct}%</p>
        </div>
        <div className="module-card accent-yellow">
          <div className="module-card-top">
            <h3>Fees collected</h3>
          </div>
          <p style={{ fontSize: "22px", color: "#1d3547" }}>
            ₹{data?.totalFeeCollected} <small style={{ fontSize: "12px", color: "#7a8a80" }}>of ₹{data?.totalFeeExpected}</small>
          </p>
        </div>
        <div className="module-card accent-coral">
          <div className="module-card-top">
            <h3>Pending leave requests</h3>
          </div>
          <p style={{ fontSize: "22px", color: "#1d3547" }}>{data?.pendingLeaveCount}</p>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: "24px" }}>
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Per class</p>
            <h2>Attendance vs average marks</h2>
          </div>
        </div>
        {(data?.classPerf || []).length === 0 ? (
          <p className="lede" style={{ padding: "20px 26px" }}>
            No classes yet.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(240, (data?.classPerf.length || 0) * 45)}>
            <BarChart data={data.classPerf} layout="vertical" margin={{ left: 20 }}>
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="label" width={80} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="attendancePct" name="Attendance %" fill="#4e9a73" radius={[0, 4, 4, 0]} />
              <Bar dataKey="avgMarksPct" name="Avg marks %" fill="#e96d5e" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </>
  );
}

export default AdminAnalyticsSection;
