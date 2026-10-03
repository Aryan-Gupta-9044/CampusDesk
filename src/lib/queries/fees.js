import { supabase } from "../supabaseClient";
import { summarizeFee, validatePaymentAmount, toAmount } from "../feeCalc";

export { totalsFromFeeStatus } from "../feeCalc";

/* =========================================================
   FEE STRUCTURE (admin)
   ========================================================= */

export async function listFeeStructures() {
  const { data, error } = await supabase
    .from("fee_structure")
    .select("id, class_id, academic_year, fee_type, amount, due_date, classes ( name, section )")
    .order("due_date");
  if (error) throw error;
  return data;
}

export async function addFeeStructure({ classId, academicYear, feeType, amount, dueDate }) {
  const { error } = await supabase.from("fee_structure").insert({
    class_id: classId,
    academic_year: academicYear,
    fee_type: feeType,
    amount,
    due_date: dueDate || null,
  });
  if (error) throw error;
}

export async function deleteFeeStructure(id) {
  const { error } = await supabase.from("fee_structure").delete().eq("id", id);
  if (error) throw error;
}

export async function listStudentsForClass(classId) {
  const { data, error } = await supabase
    .from("students")
    .select("id, roll_no, profiles!students_id_fkey ( full_name )")
    .eq("class_id", classId)
    .order("roll_no");
  if (error) throw error;
  return data;
}

/* =========================================================
   INTERNAL HELPERS
   ========================================================= */

// The fee amount always comes from the database, never from the caller —
// a stale or tampered UI value must not decide what is "payable".
async function fetchFee(feeStructureId) {
  const { data, error } = await supabase
    .from("fee_structure")
    .select("id, class_id, amount, fee_type")
    .eq("id", feeStructureId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("This fee item no longer exists.");
  return data;
}

async function fetchPayments(studentId, feeStructureId) {
  const { data, error } = await supabase
    .from("fee_payments")
    .select("id, amount_paid, status")
    .eq("student_id", studentId)
    .eq("fee_structure_id", feeStructureId);
  if (error) throw error;
  return data || [];
}

/* =========================================================
   BALANCE
   ========================================================= */

export async function getFeeBalance(studentId, feeStructureId, amount) {
  const feeAmount = amount !== undefined ? amount : (await fetchFee(feeStructureId)).amount;
  const payments = await fetchPayments(studentId, feeStructureId);
  const s = summarizeFee(feeAmount, payments);
  return {
    paidTotal: s.confirmedPaid,
    remaining: s.remaining,
    pendingCount: s.pendingCount,
    pendingTotal: s.pendingTotal,
  };
}

/* =========================================================
   ADMIN DIRECT PAYMENT ENTRY
   ========================================================= */

export async function recordPayment({ studentId, feeStructureId, amountPaid, paymentDate, mode, receiptNo, recordedBy }) {
  const fee = await fetchFee(feeStructureId);
  const payments = await fetchPayments(studentId, feeStructureId);

  const problem = validatePaymentAmount({ feeAmount: fee.amount, payments, amount: amountPaid, mode: "record" });
  if (problem) throw new Error(problem);

  const payment = Number(amountPaid);
  const before = summarizeFee(fee.amount, payments);
  const newTotal = before.confirmedPaid + payment;
  const status = newTotal >= toAmount(fee.amount) ? "paid" : "partial";

  const { error } = await supabase.from("fee_payments").insert({
    student_id: studentId,
    fee_structure_id: feeStructureId,
    amount_paid: payment,
    payment_date: paymentDate || new Date().toISOString().slice(0, 10),
    mode,
    status,
    receipt_no: receiptNo || null,
    recorded_by: recordedBy,
  });
  if (error) throw error;

  return { newTotal, remaining: Math.max(0, toAmount(fee.amount) - newTotal), status };
}

export async function listPaymentsForFeeStructure(feeStructureId) {
  const { data, error } = await supabase
    .from("fee_payments")
    .select("id, amount_paid, payment_date, mode, status, receipt_no, students ( roll_no, profiles!students_id_fkey ( full_name ) )")
    .eq("fee_structure_id", feeStructureId)
    .order("payment_date", { ascending: false });
  if (error) throw error;
  return data;
}

/* =========================================================
   STUDENT / PARENT / ADMIN-REPORT FEE STATUS
   ========================================================= */

export async function listMyFeeStatus(studentId, classId) {
  const { data: structures, error: structureError } = await supabase
    .from("fee_structure")
    .select("id, fee_type, amount, due_date")
    .eq("class_id", classId)
    .order("due_date");
  if (structureError) throw structureError;

  const { data: payments, error: paymentsError } = await supabase
    .from("fee_payments")
    .select("id, fee_structure_id, amount_paid, payment_date, mode, receipt_no, status")
    .eq("student_id", studentId)
    .order("payment_date", { ascending: false });
  if (paymentsError) throw paymentsError;

  return (structures || []).map((s) => {
    const relevant = (payments || []).filter((p) => p.fee_structure_id === s.id);
    const summary = summarizeFee(s.amount, relevant);
    return {
      ...s,
      paidTotal: summary.confirmedPaid,
      remaining: summary.remaining,
      status: summary.status,
      payments: relevant,
      pending: summary.pending,
      pendingCount: summary.pendingCount,
      pendingTotal: summary.pendingTotal,
      rejected: summary.rejected,
      canPay: summary.canPay,
      overpaid: summary.overpaid,
    };
  });
}

/* =========================================================
   STUDENT / PARENT PAYMENT REQUEST
   ========================================================= */

export async function submitPaymentRequest({ studentId, feeStructureId, amountPaid, mode, note }) {
  const requested = Number(amountPaid);
  if (!Number.isFinite(requested) || requested <= 0) {
    throw new Error("Enter a valid payment amount greater than ₹0.");
  }

  const fee = await fetchFee(feeStructureId);

  // The fee must belong to this student's class.
  const { data: student, error: studentError } = await supabase
    .from("students")
    .select("id, class_id")
    .eq("id", studentId)
    .maybeSingle();
  if (studentError) throw studentError;
  if (!student) throw new Error("Student record not found.");
  if (student.class_id !== fee.class_id) throw new Error("This fee does not apply to this student.");

  const payments = await fetchPayments(studentId, feeStructureId);
  const problem = validatePaymentAmount({ feeAmount: fee.amount, payments, amount: requested, mode: "submit" });
  if (problem) throw new Error(problem);

  const { error } = await supabase.from("fee_payments").insert({
    student_id: studentId,
    fee_structure_id: feeStructureId,
    amount_paid: requested,
    payment_date: new Date().toISOString().slice(0, 10),
    mode,
    status: "pending_verification",
    receipt_no: note || null,
  });
  if (error) {
    // The database also enforces one pending request per fee (see
    // fee_payment_guard_patch.sql); translate that into the friendly message.
    if (error.code === "23505") {
      throw new Error(
        "A payment is already pending verification for this fee. Please wait for the administrator to verify it."
      );
    }
    throw error;
  }
}

/* =========================================================
   ADMIN: PENDING REQUESTS + VERIFY
   ========================================================= */

export async function listPendingPaymentRequests() {
  const { data, error } = await supabase
    .from("fee_payments")
    .select(
      "id, student_id, fee_structure_id, amount_paid, payment_date, mode, receipt_no, status, fee_structure ( fee_type, amount ), students ( roll_no, classes ( name, section ), profiles!students_id_fkey ( full_name ) )"
    )
    .eq("status", "pending_verification")
    .order("payment_date", { ascending: false });
  if (error) throw error;
  return data;
}

// decision: "approve" | "reject". The existing pending row is updated in
// place — no new payment row is ever created. Everything is re-read from the
// database, so a double click or a second admin tab cannot approve twice.
export async function verifyPaymentRequest(id, decision, { approvedBy } = {}) {
  if (decision !== "approve" && decision !== "reject") {
    throw new Error("Unknown decision.");
  }

  const { data: row, error: rowError } = await supabase
    .from("fee_payments")
    .select("id, student_id, fee_structure_id, amount_paid, status")
    .eq("id", id)
    .maybeSingle();
  if (rowError) throw rowError;
  if (!row) throw new Error("This payment request no longer exists.");
  if (row.status !== "pending_verification") {
    throw new Error("This payment has already been processed.");
  }

  let nextStatus = "rejected";

  if (decision === "approve") {
    const fee = await fetchFee(row.fee_structure_id);
    const others = (await fetchPayments(row.student_id, row.fee_structure_id)).filter((p) => p.id !== id);

    const problem = validatePaymentAmount({
      feeAmount: fee.amount,
      payments: others,
      amount: row.amount_paid,
      mode: "approve",
    });
    if (problem) throw new Error(problem);

    const newTotal = summarizeFee(fee.amount, others).confirmedPaid + Number(row.amount_paid);
    nextStatus = newTotal >= toAmount(fee.amount) ? "paid" : "partial";
  }

  const update = { status: nextStatus };
  if (decision === "approve" && approvedBy) update.recorded_by = approvedBy;

  // Only flips a row that is STILL pending; .select() tells us if it did.
  const { data: updated, error } = await supabase
    .from("fee_payments")
    .update(update)
    .eq("id", id)
    .eq("status", "pending_verification")
    .select("id");
  if (error) throw error;
  if (!updated || updated.length === 0) {
    throw new Error("This payment was already processed by someone else.");
  }
  return nextStatus;
}
