import React, { useEffect, useState } from "react";

import { useAuth } from "../../context/AuthContext";
import { getStudent } from "../../lib/queries/students";
import { listMyFeeStatus, submitPaymentRequest } from "../../lib/queries/fees";
import { getStudentIdForParent } from "../../lib/queries/me";
import { display, modeLabel, rupees } from "../../lib/feeCalc";

const emptyForm = { amountPaid: "", mode: "upi", note: "" };

function PendingDetails({ pending }) {
  return (
    <div style={{ padding: "0 26px 12px" }}>
      <p className="eyebrow">Payment awaiting verification</p>
      {pending.map((p) => (
        <p className="lede" key={p.id} style={{ margin: "2px 0" }}>
          {rupees(p.amount_paid)} · {modeLabel(p.mode)} · {display(p.payment_date)}
          {p.receipt_no ? ` · Ref: ${p.receipt_no}` : ""} · Status: awaiting verification
        </p>
      ))}
      <p className="lede" style={{ margin: "6px 0 0" }}>
        The payment has been submitted and is awaiting administrator verification. It is not counted as paid yet.
      </p>
    </div>
  );
}

function FeeStatusView({ studentId, heading, canPay }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [payingId, setPayingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const load = async () => {
    if (!studentId) return;
    setLoading(true);
    try {
      const student = await getStudent(studentId);
      if (!student.class_id) {
        setItems([]);
        return;
      }
      setItems(await listMyFeeStatus(studentId, student.class_id));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmitPayment = async (e, feeItemId) => {
    e.preventDefault();
    if (submitting) return;
    if (!form.amountPaid) {
      setError("Enter an amount.");
      return;
    }
    setError("");
    setSubmitted(false);
    setSubmitting(true);
    try {
      await submitPaymentRequest({
        studentId,
        feeStructureId: feeItemId,
        amountPaid: form.amountPaid,
        mode: form.mode,
        note: form.note,
      });
      setForm(emptyForm);
      setPayingId(null);
      setSubmitted(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
      // Always re-read: a rejected duplicate means the list was stale.
      await load();
    }
  };

  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Finance</p>
          <h1>{heading}</h1>
          <p className="lede">Amounts due and payment history.</p>
        </div>
      </div>
      {error && <p className="form-error">{error}</p>}
      {submitted && (
        <p className="lede">Payment submitted — it is awaiting administrator verification and is not counted as paid yet.</p>
      )}
      {loading ? (
        <p className="lede">Loading…</p>
      ) : items.length === 0 ? (
        <p className="lede">No fee items set for this class yet.</p>
      ) : (
        <div className="student-list">
          {items.map((item) => (
            <div key={item.id}>
              <div className="recent-row">
                <span className="student-summary">
                  <strong>{item.fee_type}</strong>
                  <small>
                    {rupees(item.paidTotal)} of {rupees(item.amount)} paid
                    {item.remaining > 0 ? ` · ${rupees(item.remaining)} remaining` : ""} · due {display(item.due_date)}
                    {item.pendingCount > 0
                      ? ` · ${item.pendingCount} payment${item.pendingCount > 1 ? "s" : ""} awaiting verification`
                      : ""}
                  </small>
                </span>
                <span className={`status ${item.status === "paid" ? "status-active" : "status-leave"}`}>
                  <span className="dot"></span>
                  {item.status}
                </span>
                {canPay && item.canPay && (
                  <button
                    className="text-link"
                    type="button"
                    onClick={() => setPayingId(payingId === item.id ? null : item.id)}
                  >
                    {payingId === item.id ? "Cancel" : "Pay"}
                  </button>
                )}
              </div>

              {item.pendingCount > 0 && <PendingDetails pending={item.pending} />}

              {canPay && item.canPay && payingId === item.id && (
                <form
                  onSubmit={(e) => handleSubmitPayment(e, item.id)}
                  className="student-form"
                  style={{ marginBottom: "12px" }}
                >
                  <p className="eyebrow">Submit payment for verification</p>
                  <div className="form-grid">
                    <label>
                      Amount paid (max {rupees(item.remaining)})
                      <input
                        type="number"
                        name="amountPaid"
                        value={form.amountPaid}
                        onChange={handleChange}
                        min="1"
                        max={item.remaining}
                        required
                      />
                    </label>
                    <label>
                      Mode
                      <select name="mode" value={form.mode} onChange={handleChange}>
                        <option value="upi">UPI</option>
                        <option value="bank_transfer">Bank transfer</option>
                        <option value="cash">Cash (handed to office)</option>
                        <option value="cheque">Cheque</option>
                      </select>
                    </label>
                    <label>
                      Reference / note (optional)
                      <input
                        name="note"
                        value={form.note}
                        onChange={handleChange}
                        placeholder="Transaction ID, cheque no., etc."
                      />
                    </label>
                  </div>
                  <p className="lede" style={{ marginTop: "-6px" }}>
                    This won't change your balance until an admin verifies it.
                  </p>
                  <div className="form-actions">
                    <button className="button primary-button" type="submit" disabled={submitting}>
                      {submitting ? "Submitting…" : "Submit for verification"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Fees() {
  const { role, user } = useAuth();
  const [linkedStudentId, setLinkedStudentId] = useState(null);
  const [linkLoading, setLinkLoading] = useState(role === "parent");
  const [error, setError] = useState("");

  useEffect(() => {
    if (role === "parent") {
      setLinkLoading(true);
      getStudentIdForParent(user.id)
        .then(setLinkedStudentId)
        .catch((err) => setError(err.message))
        .finally(() => setLinkLoading(false));
    }
  }, [role, user]);

  if (role === "student") return <FeeStatusView studentId={user.id} heading="Fee status" canPay />;
  if (role === "parent") {
    if (error) return <p className="form-error page">{error}</p>;
    if (linkLoading) return <p className="lede page">Loading…</p>;
    if (!linkedStudentId)
      return (
        <div className="page">
          <p className="lede">Not linked to a child's account yet. Ask your school's administrator to set the link.</p>
        </div>
      );
    return <FeeStatusView studentId={linkedStudentId} heading="Child's fee status" canPay />;
  }
  return null;
}

export default Fees;
