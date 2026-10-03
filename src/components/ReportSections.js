import React from "react";

import { display, modeLabel, rupees, totalsFromFeeStatus } from "../lib/feeCalc";

function cap(value) {
  const v = display(value);
  return typeof v === "string" && v !== "—" ? v.charAt(0).toUpperCase() + v.slice(1) : v;
}

function accountStatus(status) {
  if (!status) return "—";
  return status === "active" ? "Active" : "Suspended";
}

function classLabel(cls) {
  return cls ? `${display(cls.name)}-${display(cls.section)}` : "Unassigned";
}

function Card({ title, children }) {
  return (
    <div className="details-card" style={{ marginBottom: "16px" }}>
      <p className="eyebrow">{title}</p>
      {children}
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="detail-item">
      <small>{label}</small>
      <strong>{display(value)}</strong>
    </div>
  );
}

// variant "full"    -> every field (admin full report)
// variant "summary" -> short profile block (student/parent academic report)
export function StudentInformation({ profile, student, variant = "full" }) {
  const cls = student?.classes;
  if (variant === "summary") {
    return (
      <Card title="Student profile summary">
        <Row label="Name" value={profile?.full_name} />
        <Row label="Student ID" value={student?.id} />
        <Row label="Roll number" value={student?.roll_no} />
        <Row label="Class" value={cls ? classLabel(cls) : "Unassigned"} />
        <Row label="Section" value={cls?.section} />
        <Row label="Academic year" value={cls?.academic_year} />
        <Row label="Email" value={profile?.email} />
        <Row label="Phone" value={profile?.phone} />
      </Card>
    );
  }
  return (
    <Card title="Student information">
      <Row label="Student name" value={profile?.full_name} />
      <Row label="Student ID" value={student?.id} />
      <Row label="Roll number" value={student?.roll_no} />
      <Row label="Email" value={profile?.email} />
      <Row label="Phone number" value={profile?.phone} />
      <Row label="Class" value={cls ? classLabel(cls) : "Unassigned"} />
      <Row label="Section" value={cls?.section} />
      <Row label="Academic year" value={cls?.academic_year} />
      <Row label="Date of birth" value={student?.dob} />
      <Row label="Gender" value={cap(student?.gender)} />
      <Row label="Address" value={student?.address} />
      <Row label="Admission date" value={student?.admission_date} />
      <Row label="Account status" value={accountStatus(profile?.status)} />
    </Card>
  );
}

export function ParentInformation({ parent, linked, variant = "full" }) {
  const title = variant === "summary" ? "Parent information" : "Parent / guardian information";
  if (!linked) {
    return (
      <Card title={title}>
        <p className="lede" style={{ padding: "0 26px 16px" }}>
          No parent linked
        </p>
      </Card>
    );
  }
  if (!parent) {
    return (
      <Card title={title}>
        <p className="lede" style={{ padding: "0 26px 16px" }}>
          A parent is linked, but their details are not available to you.
        </p>
      </Card>
    );
  }
  return (
    <Card title={title}>
      <Row label="Parent name" value={parent.full_name} />
      {variant === "full" && <Row label="Parent ID" value={parent.id} />}
      <Row label="Parent email" value={parent.email} />
      <Row label="Parent phone" value={parent.phone} />
      {variant === "full" && <Row label="Parent account status" value={accountStatus(parent.status)} />}
      {variant === "full" && <Row label="Relationship" value="Parent / guardian (linked via student record)" />}
    </Card>
  );
}

export function ClassTeacherInformation({ classTeacher, hasClass, variant = "full" }) {
  if (!hasClass) {
    return (
      <Card title="Class teacher">
        <p className="lede" style={{ padding: "0 26px 16px" }}>
          No class assigned
        </p>
      </Card>
    );
  }
  if (!classTeacher) {
    return (
      <Card title="Class teacher">
        <p className="lede" style={{ padding: "0 26px 16px" }}>
          No class teacher assigned
        </p>
      </Card>
    );
  }
  const p = classTeacher.profiles;
  return (
    <Card title="Class teacher">
      <Row label="Class teacher" value={p?.full_name} />
      {variant === "full" && <Row label="Employee ID" value={classTeacher.employee_id} />}
      {variant === "full" && <Row label="Email" value={p?.email} />}
      <Row label="Phone" value={p?.phone} />
      {variant === "full" && <Row label="Department" value={classTeacher.department} />}
    </Card>
  );
}

function PendingLines({ pending }) {
  return (
    <>
      {pending.map((p) => (
        <small key={p.id} style={{ display: "block" }}>
          Pending: {rupees(p.amount_paid)} · {modeLabel(p.mode)} · {display(p.payment_date)}
          {p.receipt_no ? ` · Ref: ${p.receipt_no}` : ""} — awaiting verification
        </small>
      ))}
    </>
  );
}

// Per-fee breakdown. Pending money is shown separately and never added to
// "Confirmed paid".
export function FeesDetailed({ fees }) {
  return (
    <div className="panel" style={{ marginBottom: "16px" }}>
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Fees</p>
          <h2>Status</h2>
        </div>
      </div>
      {fees.length === 0 ? (
        <p className="lede" style={{ padding: "16px 26px" }}>
          No fee items for this class.
        </p>
      ) : (
        fees.map((f) => (
          <div className="recent-row" key={f.id}>
            <span className="student-summary">
              <strong>{display(f.fee_type)}</strong>
              <small>
                Total: {rupees(f.amount)} · Confirmed paid: {rupees(f.paidTotal)} · Remaining: {rupees(f.remaining)} · Due:{" "}
                {display(f.due_date)}
              </small>
              {f.pendingCount > 0 && (
                <>
                  <small style={{ display: "block" }}>
                    {f.pendingCount} payment{f.pendingCount > 1 ? "s" : ""} awaiting verification ({rupees(f.pendingTotal)}, not
                    counted as paid)
                  </small>
                  <PendingLines pending={f.pending} />
                </>
              )}
            </span>
            <span className={`status ${f.status === "paid" ? "status-active" : "status-leave"}`}>
              <span className="dot"></span>
              {cap(f.status)}
            </span>
          </div>
        ))
      )}
    </div>
  );
}

// Compact summary for the student/parent academic report.
export function FeesCompact({ fees }) {
  const totals = totalsFromFeeStatus(fees);
  const status = fees.length === 0 ? "—" : totals.remaining <= 0 ? "Paid" : totals.paid > 0 ? "Partial" : "Due";
  return (
    <div className="panel" style={{ marginBottom: "20px" }}>
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Fees</p>
          <h2>Summary</h2>
        </div>
      </div>
      {fees.length === 0 ? (
        <p className="lede" style={{ padding: "20px 26px" }}>
          No fee items for this class.
        </p>
      ) : (
        <div className="recent-row">
          <span className="student-summary">
            <strong>
              Total {rupees(totals.total)} · Paid {rupees(totals.paid)} · Remaining {rupees(totals.remaining)}
            </strong>
            <small>
              {totals.pendingCount > 0
                ? `${totals.pendingCount} payment${totals.pendingCount > 1 ? "s" : ""} awaiting verification (${rupees(
                    totals.pendingTotal
                  )}) — not counted as paid yet`
                : "No payments awaiting verification"}
            </small>
          </span>
          <span className={`status ${status === "Paid" ? "status-active" : "status-leave"}`}>
            <span className="dot"></span>
            {status}
          </span>
        </div>
      )}
    </div>
  );
}
