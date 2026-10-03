import React from "react";
import { render, screen } from "@testing-library/react";

import { StudentInformation, ParentInformation, ClassTeacherInformation, FeesDetailed, FeesCompact } from "./ReportSections";

const student = {
  id: "11111111-aaaa", roll_no: "10A-001", dob: "2010-03-04", gender: "female", address: "Noida",
  admission_date: "2026-01-02", class_id: "c1",
  classes: { name: "10", section: "A", academic_year: "2026-27" },
};
const profile = { full_name: "Ananya Mehta", email: "ananya@gmail.com", phone: "9700000001", status: "active" };

test("student information lists every required field", () => {
  render(<StudentInformation profile={profile} student={student} />);
  ["Student name", "Student ID", "Roll number", "Email", "Phone number", "Class", "Section", "Academic year",
    "Date of birth", "Gender", "Address", "Admission date", "Account status"].forEach((l) =>
    expect(screen.getByText(l)).toBeInTheDocument()
  );
  expect(screen.getByText("11111111-aaaa")).toBeInTheDocument();
  expect(screen.getByText("Female")).toBeInTheDocument();
  expect(screen.getByText("Active")).toBeInTheDocument();
});

test("missing values render an em dash, never undefined/null", () => {
  const { container } = render(<StudentInformation profile={{ full_name: "X" }} student={{ id: "i", classes: null }} />);
  expect(container.textContent).not.toMatch(/undefined|null|NaN/);
  expect(screen.getAllByText("—").length).toBeGreaterThan(3);
});

test("parent: not linked / linked / linked but unreadable", () => {
  const { rerender } = render(<ParentInformation parent={null} linked={false} />);
  expect(screen.getByText("No parent linked")).toBeInTheDocument();
  rerender(<ParentInformation linked parent={{ id: "p1", full_name: "Mr Mehta", email: "m@x.com", phone: null, status: "active" }} />);
  expect(screen.getByText("Mr Mehta")).toBeInTheDocument();
  expect(screen.getByText("p1")).toBeInTheDocument();
  rerender(<ParentInformation linked parent={null} />);
  expect(screen.getByText(/details are not available/)).toBeInTheDocument();
});

test("class teacher: details, none assigned, no class", () => {
  const ct = { employee_id: "EMP-001", department: "Mathematics", profiles: { full_name: "Anita Sharma", email: "anita@gmail.com", phone: "9800000001" } };
  const { rerender } = render(<ClassTeacherInformation classTeacher={ct} hasClass />);
  ["Anita Sharma", "EMP-001", "anita@gmail.com", "9800000001", "Mathematics"].forEach((t) => expect(screen.getByText(t)).toBeInTheDocument());
  rerender(<ClassTeacherInformation classTeacher={null} hasClass />);
  expect(screen.getByText("No class teacher assigned")).toBeInTheDocument();
  rerender(<ClassTeacherInformation classTeacher={null} hasClass={false} />);
  expect(screen.getByText("No class assigned")).toBeInTheDocument();
});

const fees = [{
  id: "f1", fee_type: "Tuition Fee", amount: 45000, paidTotal: 20000, remaining: 25000, due_date: "2026-10-31",
  status: "partial", pendingCount: 1, pendingTotal: 5000,
  pending: [{ id: "x", amount_paid: 5000, mode: "upi", payment_date: "2026-10-02", receipt_no: "" }],
}];

test("detailed fees keep pending separate from confirmed paid", () => {
  render(<FeesDetailed fees={fees} />);
  expect(screen.getByText(/Total: ₹45000 · Confirmed paid: ₹20000 · Remaining: ₹25000 · Due: 2026-10-31/)).toBeInTheDocument();
  expect(screen.getByText(/Pending: ₹5000 · UPI · 2026-10-02 — awaiting verification/)).toBeInTheDocument();
  expect(screen.getByText("Partial")).toBeInTheDocument();
});

test("compact fee summary", () => {
  render(<FeesCompact fees={fees} />);
  expect(screen.getByText("Total ₹45000 · Paid ₹20000 · Remaining ₹25000")).toBeInTheDocument();
  expect(screen.getByText(/1 payment awaiting verification \(₹5000\) — not counted as paid yet/)).toBeInTheDocument();
});
