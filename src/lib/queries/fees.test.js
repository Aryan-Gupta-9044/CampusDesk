import { createFakeDb } from "../../testUtils/fakeSupabase";

let mockDb;
jest.mock("../supabaseClient", () => ({
  get supabase() {
    return mockDb.client;
  },
}));

const {
  submitPaymentRequest,
  verifyPaymentRequest,
  listMyFeeStatus,
  recordPayment,
  getFeeBalance,
} = require("./fees");

const FEE = "fee-1";
const STU = "stu-1";

function seed({ amount = 45000, payments = [] } = {}) {
  mockDb = createFakeDb({
    fee_structure: [{ id: FEE, class_id: "c1", fee_type: "Tuition", amount, due_date: "2026-10-23" }],
    students: [{ id: STU, class_id: "c1" }],
    fee_payments: payments.map((p, i) => ({ id: `p${i}`, student_id: STU, fee_structure_id: FEE, ...p })),
  });
}

const submit = (amountPaid) =>
  submitPaymentRequest({ studentId: STU, feeStructureId: FEE, amountPaid, mode: "upi", note: "ref" });

describe("duplicate payment scenario (spec section 27)", () => {
  test("submit -> pending -> duplicate rejected -> reject -> pay again -> approve", async () => {
    seed({ amount: 200000 });

    // 2-3. Student submits 2000 -> pending
    await submit(2000);
    let [item] = await listMyFeeStatus(STU, "c1");
    expect(item).toMatchObject({ paidTotal: 0, remaining: 200000, status: "due", pendingCount: 1, canPay: false });

    // 5-7. Pay button gone (canPay false); a second submit through the UI path is rejected
    await expect(submit(500)).rejects.toThrow(/already pending verification/);
    expect(mockDb.tables.fee_payments).toHaveLength(1);

    // 8-10. Parent reads the SAME status (same query by student id) and also gets no Pay
    [item] = await listMyFeeStatus(STU, "c1");
    expect(item.pending[0]).toMatchObject({ amount_paid: 2000, mode: "upi", status: "pending_verification" });
    expect(item.canPay).toBe(false);
    await expect(submit(100)).rejects.toThrow(/already pending verification/);

    // 11-12. Admin rejects
    const pendingRow = mockDb.tables.fee_payments[0];
    await verifyPaymentRequest(pendingRow.id, "reject");
    expect(pendingRow.status).toBe("rejected");

    // 13-15. Pending gone, Pay back, balance untouched
    [item] = await listMyFeeStatus(STU, "c1");
    expect(item).toMatchObject({ paidTotal: 0, remaining: 200000, pendingCount: 0, canPay: true });

    // 16-18. New valid payment -> approve -> confirmed paid updates
    await submit(5000);
    const second = mockDb.tables.fee_payments.find((p) => p.status === "pending_verification");
    await verifyPaymentRequest(second.id, "approve");
    [item] = await listMyFeeStatus(STU, "c1");
    expect(item).toMatchObject({ paidTotal: 5000, remaining: 195000, status: "partial", pendingCount: 0, canPay: true });
    // approval updates the existing row, never inserts a new one
    expect(mockDb.tables.fee_payments).toHaveLength(2);
  });
});

describe("submitPaymentRequest validation", () => {
  test("TEST 8: more than remaining is blocked with exact message, nothing inserted", async () => {
    seed({ payments: [{ amount_paid: 20000, status: "partial" }] });
    await expect(submit(25001)).rejects.toThrow("You can pay a maximum of ₹25000.");
    expect(mockDb.tables.fee_payments).toHaveLength(1);
  });

  test("exactly the remaining amount is allowed", async () => {
    seed({ payments: [{ amount_paid: 20000, status: "partial" }] });
    await submit(25000);
    expect(mockDb.tables.fee_payments.at(-1)).toMatchObject({ amount_paid: 25000, status: "pending_verification" });
  });

  test("TEST 10: fully paid fee cannot receive a submission", async () => {
    seed({ payments: [{ amount_paid: 45000, status: "paid" }] });
    await expect(submit(1)).rejects.toThrow(/fully paid/);
  });

  test.each(["", "abc", "0", "-10"])("invalid amount %p rejected", async (v) => {
    seed();
    await expect(submit(v)).rejects.toThrow(/valid payment amount/);
    expect(mockDb.tables.fee_payments).toHaveLength(0);
  });

  test("missing fee is reported clearly", async () => {
    seed();
    await expect(
      submitPaymentRequest({ studentId: STU, feeStructureId: "nope", amountPaid: 10, mode: "upi" })
    ).rejects.toThrow(/no longer exists/);
  });

  test("fee from another class is refused", async () => {
    seed();
    mockDb.tables.students[0].class_id = "other-class";
    await expect(submit(10)).rejects.toThrow(/does not apply/);
  });

  test("DB unique-index race (code 23505) becomes the friendly message", async () => {
    seed();
    // Simulate a concurrent tab: a pending row appears AFTER our check by
    // making the pre-check see an empty list but the insert collide.
    mockDb.tables.fee_payments.push({
      id: "raced", student_id: STU, fee_structure_id: FEE, amount_paid: 1, status: "pending_verification",
    });
    const realFrom = mockDb.client.from;
    let selects = 0;
    mockDb.client.from = (t) => {
      const b = realFrom(t);
      if (t === "fee_payments") {
        const origEq = b.eq;
        b.eq = (k, v) => {
          const r = origEq(k, v);
          return r;
        };
        const origThen = b.then;
        b.then = (res, rej) => {
          selects += 1;
          // first fee_payments read (the pre-check) returns nothing
          if (selects === 1) return Promise.resolve({ data: [], error: null }).then(res, rej);
          return origThen(res, rej);
        };
      }
      return b;
    };
    await expect(submit(10)).rejects.toThrow(/already pending verification/);
  });
});

describe("verifyPaymentRequest", () => {
  test("TEST 6: approving 5000 raises confirmed paid by 5000 and clears pending", async () => {
    seed({ payments: [{ amount_paid: 20000, status: "partial" }, { amount_paid: 5000, status: "pending_verification" }] });
    const status = await verifyPaymentRequest("p1", "approve", { approvedBy: "admin-1" });
    expect(status).toBe("partial");
    const [item] = await listMyFeeStatus(STU, "c1");
    expect(item).toMatchObject({ paidTotal: 25000, remaining: 20000, pendingCount: 0, canPay: true });
  });

  test("approval that completes the fee becomes paid and hides Pay", async () => {
    seed({ payments: [{ amount_paid: 40000, status: "partial" }, { amount_paid: 5000, status: "pending_verification" }] });
    expect(await verifyPaymentRequest("p1", "approve")).toBe("paid");
    const [item] = await listMyFeeStatus(STU, "c1");
    expect(item).toMatchObject({ status: "paid", remaining: 0, canPay: false });
  });

  test("TEST 7: reject leaves confirmed unchanged and Pay returns", async () => {
    seed({ payments: [{ amount_paid: 20000, status: "partial" }, { amount_paid: 5000, status: "pending_verification" }] });
    await verifyPaymentRequest("p1", "reject");
    const [item] = await listMyFeeStatus(STU, "c1");
    expect(item).toMatchObject({ paidTotal: 20000, remaining: 25000, pendingCount: 0, canPay: true });
  });

  test("the same payment cannot be approved twice", async () => {
    seed({ payments: [{ amount_paid: 5000, status: "pending_verification" }] });
    await verifyPaymentRequest("p0", "approve");
    await expect(verifyPaymentRequest("p0", "approve")).rejects.toThrow(/already been processed/);
    const [item] = await listMyFeeStatus(STU, "c1");
    expect(item.paidTotal).toBe(5000);
  });

  test("an approval that would overpay is refused and the row stays pending", async () => {
    seed({ payments: [{ amount_paid: 44000, status: "partial" }, { amount_paid: 5000, status: "pending_verification" }] });
    await expect(verifyPaymentRequest("p1", "approve")).rejects.toThrow(/only ₹1000 remains/);
    expect(mockDb.tables.fee_payments[1].status).toBe("pending_verification");
  });

  test("approval uses the DB amount, not a caller-supplied one", async () => {
    seed({ payments: [{ amount_paid: 5000, status: "pending_verification" }] });
    await verifyPaymentRequest("p0", "approve", { approvedBy: "a", amountPaid: 1, feeAmount: 1 });
    expect(mockDb.tables.fee_payments[0].amount_paid).toBe(5000);
  });
});

describe("admin recordPayment", () => {
  const rec = (amountPaid) =>
    recordPayment({ studentId: STU, feeStructureId: FEE, amountPaid, mode: "cash", receiptNo: "R1", recordedBy: "admin" });

  test("records a partial payment with derived status", async () => {
    seed();
    expect(await rec(20000)).toMatchObject({ status: "partial", remaining: 25000 });
  });

  test("blocks overpayment (₹210 of ₹200 style)", async () => {
    seed({ amount: 200, payments: [{ amount_paid: 150, status: "partial" }] });
    await expect(rec(60)).rejects.toThrow(/exceeds the remaining balance of ₹50/);
    expect(mockDb.tables.fee_payments).toHaveLength(1);
  });

  test("blocks a payment on an already-paid fee", async () => {
    seed({ payments: [{ amount_paid: 45000, status: "paid" }] });
    await expect(rec(1)).rejects.toThrow(/already been fully paid/);
  });

  test("getFeeBalance ignores pending and reports it separately", async () => {
    seed({ payments: [{ amount_paid: 20000, status: "partial" }, { amount_paid: 5000, status: "pending_verification" }] });
    expect(await getFeeBalance(STU, FEE)).toMatchObject({ paidTotal: 20000, remaining: 25000, pendingCount: 1, pendingTotal: 5000 });
  });
});
