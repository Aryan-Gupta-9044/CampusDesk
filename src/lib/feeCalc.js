// One definition of how a fee item's balance is calculated.
// Every page (student/parent Fees, admin reports, dashboards, query
// validation) must go through summarizeFee() so they can never disagree.
//
// fee_payments.status meanings:
//   paid / partial        -> admin-confirmed money (counts toward the balance)
//   pending_verification  -> submitted by student/parent, NOT yet counted
//   rejected              -> declined by admin, never counted
//   due                   -> legacy placeholder, never counted

export const CONFIRMED_STATUSES = ["paid", "partial"];
export const PENDING_STATUS = "pending_verification";
export const REJECTED_STATUS = "rejected";

export function toAmount(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function isConfirmed(payment) {
  return CONFIRMED_STATUSES.includes(payment?.status);
}

export function isPending(payment) {
  return payment?.status === PENDING_STATUS;
}

export function isRejected(payment) {
  return payment?.status === REJECTED_STATUS;
}

export function sumAmounts(payments) {
  return (payments || []).reduce((sum, p) => sum + toAmount(p.amount_paid), 0);
}

// Returns everything a screen needs to know about one fee item.
//   confirmedPaid  - confirmed money, capped at the fee amount so a legacy
//                    over-recorded row can never show "₹45300 of ₹45000"
//   remaining      - max(0, fee - confirmedPaid); pending is NOT subtracted
//   status         - "paid" | "partial" | "due" (pending never changes it)
//   pending        - rows awaiting admin verification
//   canPay         - balance remains AND nothing is awaiting verification
export function summarizeFee(feeAmount, payments) {
  const total = toAmount(feeAmount);
  const rows = payments || [];

  const confirmed = rows.filter(isConfirmed);
  const pending = rows.filter(isPending);
  const rejected = rows.filter(isRejected);

  const rawConfirmed = sumAmounts(confirmed);
  const confirmedPaid = Math.min(rawConfirmed, total);
  const remaining = Math.max(0, total - confirmedPaid);

  let status = "due";
  if (remaining <= 0) status = "paid";
  else if (confirmedPaid > 0) status = "partial";

  return {
    total,
    confirmedPaid,
    remaining,
    status,
    confirmed,
    pending,
    pendingCount: pending.length,
    pendingTotal: sumAmounts(pending),
    rejected,
    hasPending: pending.length > 0,
    canPay: remaining > 0 && pending.length === 0,
    // true only for historical rows that were recorded above the fee amount
    overpaid: rawConfirmed > total,
  };
}

// Shared by every path that creates or confirms money. Returns an error
// message string, or null when the amount is acceptable.
//   mode "submit"  - student/parent request: blocked if one is pending already
//   mode "record"  - admin direct entry: pending requests don't block it
//   mode "approve" - amount is the pending row itself (excluded from `payments`)
export function validatePaymentAmount({ feeAmount, payments, amount, mode = "submit" }) {
  const requested = Number(amount);
  if (!Number.isFinite(requested) || requested <= 0) {
    return "Enter a valid payment amount greater than ₹0.";
  }
  if (!Number.isFinite(Number(feeAmount)) || Number(feeAmount) <= 0) {
    return "Fee item not found or has an invalid amount.";
  }

  const summary = summarizeFee(feeAmount, payments);

  if (summary.remaining <= 0) {
    return mode === "approve"
      ? "Cannot approve: this fee is already fully paid. Reject the request instead."
      : "This fee has already been fully paid. No further payment is required.";
  }
  if (mode === "submit" && summary.hasPending) {
    return "A payment is already pending verification for this fee. Please wait for the administrator to verify it.";
  }
  if (requested > summary.remaining) {
    if (mode === "approve") {
      return `Cannot approve: only ₹${summary.remaining} remains on this fee, but this payment is ₹${requested}. Reject it or ask for a smaller amount.`;
    }
    if (mode === "record") {
      return `Payment exceeds the remaining balance of ₹${summary.remaining}.`;
    }
    return `You can pay a maximum of ₹${summary.remaining}.`;
  }
  return null;
}

// Display helpers — never let undefined/null/NaN reach the screen.
export function display(value) {
  if (value === undefined || value === null || value === "") return "—";
  if (typeof value === "number" && Number.isNaN(value)) return "—";
  return value;
}

export function rupees(value) {
  return `₹${toAmount(value)}`;
}

const MODE_LABELS = {
  upi: "UPI",
  bank_transfer: "Bank transfer",
  cash: "Cash",
  cheque: "Cheque",
};

export function modeLabel(mode) {
  return MODE_LABELS[mode] || display(mode);
}

// Compact totals for one student, used by the academic report.
export function totalsFromFeeStatus(items) {
  const list = items || [];
  return {
    total: list.reduce((s, i) => s + toAmount(i.amount), 0),
    paid: list.reduce((s, i) => s + toAmount(i.paidTotal), 0),
    remaining: list.reduce((s, i) => s + toAmount(i.remaining), 0),
    pendingCount: list.reduce((s, i) => s + (i.pendingCount || 0), 0),
    pendingTotal: list.reduce((s, i) => s + toAmount(i.pendingTotal), 0),
  };
}
