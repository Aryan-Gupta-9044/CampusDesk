import React, { useEffect, useState } from "react";

import { listClasses } from "../../lib/queries/classes";
import {
  listFeeStructures,
  addFeeStructure,
  deleteFeeStructure,
  listStudentsForClass,
  recordPayment,
  listPaymentsForFeeStructure,
  getFeeBalance,
  listPendingPaymentRequests,
  verifyPaymentRequest,
} from "../../lib/queries/fees";
import { useAuth } from "../../context/AuthContext";
import { generateReceiptNo } from "../../lib/idGenerator";
import IdConfirmModal from "../../components/IdConfirmModal";
import { display, modeLabel, rupees } from "../../lib/feeCalc";

const emptyForm = { classId: "", academicYear: "", feeType: "", amount: "", dueDate: "" };
const emptyPaymentForm = { studentId: "", amountPaid: "", paymentDate: "", mode: "cash", receiptNo: "" };

function AdminFees() {
  const { user } = useAuth();
  const [classes, setClasses] = useState([]);
  const [structures, setStructures] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [students, setStudents] = useState([]);
  const [payments, setPayments] = useState([]);
  const [paymentForm, setPaymentForm] = useState(emptyPaymentForm);
  const [balance, setBalance] = useState(null);
  const [receiptPayment, setReceiptPayment] = useState(null);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [confirmation, setConfirmation] = useState(null);
  const [verifyingId, setVerifyingId] = useState(null);
  const [notice, setNotice] = useState("");

  const loadPending = () => {
    listPendingPaymentRequests().then(setPendingRequests).catch((err) => setError(err.message));
  };

  useEffect(() => {
    loadPending();
  }, []);

  const handleVerify = async (request, decision) => {
    if (verifyingId) return; // one decision at a time — no double approval
    setVerifyingId(request.id);
    setError("");
    setNotice("");
    try {
      await verifyPaymentRequest(request.id, decision, { approvedBy: user.id });
      setNotice(
        decision === "approve"
          ? `Approved ${rupees(request.amount_paid)} for ${display(request.students?.profiles?.full_name)}.`
          : `Rejected ${rupees(request.amount_paid)} for ${display(request.students?.profiles?.full_name)}.`
      );
      if (selectedId === request.fee_structure_id) {
        const paymentsData = await listPaymentsForFeeStructure(selectedId);
        setPayments(paymentsData);
        if (paymentForm.studentId) {
          getFeeBalance(paymentForm.studentId, selectedId).then(setBalance).catch(() => setBalance(null));
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setVerifyingId(null);
      loadPending(); // always refresh so a stale row disappears
    }
  };

  const loadStructures = async () => {
    try {
      const data = await listFeeStructures();
      setStructures(data);
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    listClasses().then(setClasses).catch((err) => setError(err.message));
    loadStructures();
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleAdd = async (event) => {
    event.preventDefault();
    if (!form.classId || !form.feeType.trim() || !form.amount) {
      setError("Class, fee type, and amount are required.");
      return;
    }
    setError("");
    try {
      await addFeeStructure(form);
      setForm(emptyForm);
      await loadStructures();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (structure) => {
    if (!window.confirm(`Delete fee item "${structure.fee_type}"?`)) return;
    try {
      await deleteFeeStructure(structure.id);
      if (selectedId === structure.id) setSelectedId(null);
      await loadStructures();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSelect = async (structure) => {
    setSelectedId(structure.id);
    setPaymentForm(emptyPaymentForm);
    setBalance(null);
    try {
      const [rosterData, paymentsData] = await Promise.all([
        listStudentsForClass(structure.class_id),
        listPaymentsForFeeStructure(structure.id),
      ]);
      setStudents(rosterData);
      setPayments(paymentsData);
    } catch (err) {
      setError(err.message);
    }
  };

  const handlePaymentChange = async (event) => {
    const { name, value } = event.target;
    setPaymentForm((prev) => ({ ...prev, [name]: value }));

    if (name === "studentId" && value && selectedStructure) {
      try {
        const bal = await getFeeBalance(value, selectedId);
        setBalance(bal);
      } catch (err) {
        setBalance(null);
      }
    } else if (name === "studentId" && !value) {
      setBalance(null);
    }
  };

  const handleRecordPayment = async (event) => {
    event.preventDefault();
    if (!paymentForm.studentId || !paymentForm.amountPaid) {
      setError("Select a student and enter an amount.");
      return;
    }
    setError("");
    try {
      const receiptNo = await generateReceiptNo();
      const studentName = students.find((s) => s.id === paymentForm.studentId)?.profiles?.full_name;
      await recordPayment({
        ...paymentForm,
        receiptNo,
        feeStructureId: selectedId,
        recordedBy: user.id,
      });
      setPaymentForm(emptyPaymentForm);
      setBalance(null);
      const paymentsData = await listPaymentsForFeeStructure(selectedId);
      setPayments(paymentsData);
      setConfirmation({
        title: "Payment recorded",
        rows: [
          { label: "Student", value: studentName },
          { label: "Receipt no.", value: receiptNo },
          { label: "Amount", value: `₹${paymentForm.amountPaid}` },
        ],
      });
    } catch (err) {
      setError(err.message);
    }
  };

  const selectedStructure = structures.find((s) => s.id === selectedId);

  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Finance</p>
          <h1>Fees</h1>
          <p className="lede">Define fee items per class, then record payments as they come in.</p>
        </div>
      </div>

      {error && <p className="form-error">{error}</p>}

      {notice && <p className="lede">{notice}</p>}

      {pendingRequests.length > 0 && (
        <div className="panel" style={{ marginBottom: "20px" }}>
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Awaiting verification</p>
              <h2>
                {pendingRequests.length} submitted payment{pendingRequests.length > 1 ? "s" : ""}
              </h2>
            </div>
          </div>
          {pendingRequests.map((r) => (
            <div className="recent-row" key={r.id}>
              <span className="student-summary">
                <strong>
                  {display(r.students?.profiles?.full_name)} · Roll no. {display(r.students?.roll_no)} ·{" "}
                  {r.students?.classes ? `${r.students.classes.name}-${r.students.classes.section}` : "—"}
                </strong>
                <small>
                  {display(r.fee_structure?.fee_type)} (fee {rupees(r.fee_structure?.amount)}) · Submitted{" "}
                  {rupees(r.amount_paid)} · {modeLabel(r.mode)} · {display(r.payment_date)}
                  {r.receipt_no ? ` · Ref: "${r.receipt_no}"` : ""} · Status: awaiting verification
                </small>
              </span>
              <button
                className="text-link"
                type="button"
                disabled={Boolean(verifyingId)}
                onClick={() => handleVerify(r, "approve")}
              >
                {verifyingId === r.id ? "Working…" : "Approve"}
              </button>
              <button
                className="text-link"
                type="button"
                disabled={Boolean(verifyingId)}
                onClick={() => handleVerify(r, "reject")}
              >
                Reject
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="detail-grid">
        <div className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Fee items</p>
              <h2>{structures.length} defined</h2>
            </div>
          </div>
          {structures.map((s) => (
            <div
              key={s.id}
              className="recent-row"
              style={{ cursor: "pointer", background: selectedId === s.id ? "#f6f7f5" : "transparent" }}
              onClick={() => handleSelect(s)}
            >
              <span className="student-summary">
                <strong>
                  {s.fee_type} — ₹{s.amount}
                </strong>
                <small>
                  {s.classes?.name}-{s.classes?.section} · {s.academic_year} · due {s.due_date || "—"}
                </small>
              </span>
              <button
                className="delete-button"
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(s);
                }}
                title="Delete"
              >
                ×
              </button>
            </div>
          ))}

          <form onSubmit={handleAdd} className="student-form" style={{ boxShadow: "none", borderTop: "1px solid var(--line)" }}>
            <p className="eyebrow" style={{ marginTop: "10px" }}>
              Add a fee item
            </p>
            <div className="form-grid">
              <label>
                Class
                <select name="classId" value={form.classId} onChange={handleChange} required>
                  <option value="">Select class</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}-{c.section}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Academic year
                <input name="academicYear" placeholder="2026-27" value={form.academicYear} onChange={handleChange} />
              </label>
              <label>
                Fee type
                <input name="feeType" placeholder="Tuition" value={form.feeType} onChange={handleChange} required />
              </label>
              <label>
                Amount
                <input type="number" name="amount" value={form.amount} onChange={handleChange} required />
              </label>
              <label>
                Due date
                <input type="date" name="dueDate" value={form.dueDate} onChange={handleChange} />
              </label>
            </div>
            <div className="form-actions">
              <button type="submit" className="button primary-button">
                Add fee item
              </button>
            </div>
          </form>
        </div>

        <div className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Payments</p>
              <h2>{selectedStructure ? selectedStructure.fee_type : "Select a fee item"}</h2>
            </div>
          </div>

          {!selectedStructure ? (
            <p className="lede" style={{ padding: "20px 26px" }}>
              Click a fee item on the left to record and view payments.
            </p>
          ) : (
            <>
              {payments.length === 0 ? (
                <p className="lede" style={{ padding: "20px 26px" }}>
                  No payments recorded yet.
                </p>
              ) : (
                payments.map((p) => (
                  <div className="recent-row" key={p.id}>
                    <span className="student-summary">
                      <strong>{p.students?.profiles?.full_name}</strong>
                      <small>
                        {rupees(p.amount_paid)} · {modeLabel(p.mode)} · {display(p.payment_date)}
                      </small>
                    </span>
                    <span className={`status ${p.status === "paid" ? "status-active" : "status-leave"}`}>
                      <span className="dot"></span>
                      {p.status}
                    </span>
                    <button
                      className="text-link no-print"
                      type="button"
                      onClick={() => {
                        setReceiptPayment(p);
                        setTimeout(() => window.print(), 100);
                      }}
                    >
                      Print receipt
                    </button>
                  </div>
                ))
              )}

              {receiptPayment && (
                <div className="print-only print-area">
                  <h2>Fee Receipt</h2>
                  <p>Receipt no: {receiptPayment.receipt_no || "—"}</p>
                  <p>Student: {receiptPayment.students?.profiles?.full_name}</p>
                  <p>Roll no: {receiptPayment.students?.roll_no || "—"}</p>
                  <p>Fee item: {selectedStructure?.fee_type}</p>
                  <p>Amount paid: ₹{receiptPayment.amount_paid}</p>
                  <p>Payment date: {receiptPayment.payment_date || "—"}</p>
                  <p>Mode: {receiptPayment.mode}</p>
                  <p>Status: {receiptPayment.status}</p>
                </div>
              )}

              <form onSubmit={handleRecordPayment} className="student-form" style={{ boxShadow: "none", borderTop: "1px solid var(--line)" }}>
                <p className="eyebrow" style={{ marginTop: "10px" }}>
                  Record a payment
                </p>
                <div className="form-grid">
                  <label>
                    Student
                    <select name="studentId" value={paymentForm.studentId} onChange={handlePaymentChange} required>
                      <option value="">Select student</option>
                      {students.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.profiles?.full_name} ({s.roll_no || "—"})
                        </option>
                      ))}
                    </select>
                  </label>
                  {balance && (
                    <p className="lede" style={{ gridColumn: "1 / -1", margin: 0 }}>
                      Confirmed paid: {rupees(balance.paidTotal)} · <strong>Remaining: {rupees(balance.remaining)}</strong>
                      {balance.pendingCount > 0 ? ` · ${balance.pendingCount} pending verification (${rupees(balance.pendingTotal)}, not counted)` : ""}
                    </p>
                  )}
                  <label>
                    Amount paid
                    <input type="number" name="amountPaid" value={paymentForm.amountPaid} onChange={handlePaymentChange} min="1" max={balance ? balance.remaining : undefined} required />
                  </label>
                  <label>
                    Payment date
                    <input type="date" name="paymentDate" value={paymentForm.paymentDate} onChange={handlePaymentChange} />
                  </label>
                  <label>
                    Mode
                    <select name="mode" value={paymentForm.mode} onChange={handlePaymentChange}>
                      <option value="cash">Cash</option>
                      <option value="cheque">Cheque</option>
                      <option value="upi">UPI</option>
                      <option value="bank_transfer">Bank transfer</option>
                    </select>
                  </label>
                </div>
                <div className="form-actions">
                  <button type="submit" className="button primary-button">
                    Record payment
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>

      {confirmation && (
        <IdConfirmModal title={confirmation.title} rows={confirmation.rows} onClose={() => setConfirmation(null)} />
      )}
    </div>
  );
}

export default AdminFees;
