import React from "react";
import { render, screen, waitFor } from "@testing-library/react";

import Fees from "./Fees";
import { summarizeFee } from "../../lib/feeCalc";

let mockRole = "student";
const mockUser = { id: "u1" }; // stable identity, like the real AuthContext
jest.mock("../../context/AuthContext", () => ({
  useAuth: () => ({ role: mockRole, user: mockUser }),
}));
jest.mock("../../lib/queries/students", () => ({ getStudent: jest.fn() }));
jest.mock("../../lib/queries/me", () => ({ getStudentIdForParent: jest.fn() }));
jest.mock("../../lib/queries/fees", () => ({
  listMyFeeStatus: jest.fn(),
  submitPaymentRequest: jest.fn(),
}));

const { listMyFeeStatus } = require("../../lib/queries/fees");
const { getStudent } = require("../../lib/queries/students");
const { getStudentIdForParent } = require("../../lib/queries/me");

function item(id, fee_type, amount, payments) {
  const s = summarizeFee(amount, payments);
  return {
    id, fee_type, amount, due_date: "2026-10-23",
    paidTotal: s.confirmedPaid, remaining: s.remaining, status: s.status,
    pending: s.pending, pendingCount: s.pendingCount, pendingTotal: s.pendingTotal, canPay: s.canPay,
  };
}
const p = (amount_paid, status, extra = {}) => ({ id: `${status}${amount_paid}`, amount_paid, status, mode: "upi", payment_date: "2026-10-02", receipt_no: "", ...extra });

// CRA resets jest.fn() implementations between tests, so set them here.
beforeEach(() => {
  getStudent.mockResolvedValue({ id: "s1", class_id: "c1" });
  getStudentIdForParent.mockResolvedValue("s1");
  listMyFeeStatus.mockResolvedValue([
    item("f1", "Tuition", 200000, [p(2000, "pending_verification", { receipt_no: "UPI123" })]),
    item("f2", "Library", 45000, [p(45000, "paid")]),
    item("f3", "Transport", 45000, [p(20000, "partial")]),
    item("f4", "Lab", 5000, []),
  ]);
});

describe.each(["student", "parent"])("Fees page as %s", (role) => {
  beforeEach(() => {
    mockRole = role;
  });

  test("pending fee: shows pending message + details and NO Pay button", async () => {
    render(<Fees />);
    await waitFor(() => expect(screen.getByText("Tuition")).toBeInTheDocument());

    expect(screen.getByText(/₹0 of ₹200000 paid · ₹200000 remaining/)).toBeInTheDocument();
    expect(screen.getByText(/1 payment awaiting verification/)).toBeInTheDocument();
    expect(screen.getByText(/₹2000 · UPI · 2026-10-02 · Ref: UPI123/)).toBeInTheDocument();
    expect(screen.getByText(/awaiting administrator verification/)).toBeInTheDocument();
  });

  test("Pay appears only for partial and unpaid fees without a pending payment", async () => {
    render(<Fees />);
    await waitFor(() => expect(screen.getByText("Tuition")).toBeInTheDocument());
    // Transport (partial) + Lab (unpaid) only: pending Tuition and paid Library have none
    expect(screen.getAllByRole("button", { name: "Pay" })).toHaveLength(2);
  });

  test("fully paid fee shows no remaining text and no Pay", async () => {
    render(<Fees />);
    await waitFor(() => expect(screen.getByText("Library")).toBeInTheDocument());
    expect(screen.getByText(/₹45000 of ₹45000 paid · due/)).toBeInTheDocument();
    expect(screen.getByText(/₹20000 of ₹45000 paid · ₹25000 remaining/)).toBeInTheDocument();
  });

  test("a failing query shows an error, not a blank page", async () => {
    listMyFeeStatus.mockRejectedValueOnce(new Error("permission denied"));
    render(<Fees />);
    await waitFor(() => expect(screen.getByText("permission denied")).toBeInTheDocument());
  });

  test("never renders undefined/null/NaN", async () => {
    const { container } = render(<Fees />);
    await waitFor(() => expect(screen.getByText("Tuition")).toBeInTheDocument());
    expect(container.textContent).not.toMatch(/undefined|null|NaN/);
  });
});
