import { summarizeFee, validatePaymentAmount, display, rupees } from "./feeCalc";

const pay = (amount, status) => ({ id: `${status}-${amount}`, amount_paid: amount, status });

describe("summarizeFee — fee state matrix", () => {
  test("TEST 1: fully paid -> paid, no Pay", () => {
    const s = summarizeFee(45000, [pay(45000, "paid")]);
    expect(s).toMatchObject({ confirmedPaid: 45000, remaining: 0, status: "paid", canPay: false });
  });

  test("TEST 2: partially paid -> partial, 25000 remaining, Pay allowed", () => {
    const s = summarizeFee(45000, [pay(20000, "partial")]);
    expect(s).toMatchObject({ confirmedPaid: 20000, remaining: 25000, status: "partial", canPay: true });
  });

  test("TEST 3: unpaid -> due, Pay allowed", () => {
    const s = summarizeFee(45000, []);
    expect(s).toMatchObject({ confirmedPaid: 0, remaining: 45000, status: "due", canPay: true });
  });

  test("TEST 4: unpaid + 5000 pending -> due, 45000 remaining, NO Pay", () => {
    const s = summarizeFee(45000, [pay(5000, "pending_verification")]);
    expect(s).toMatchObject({
      confirmedPaid: 0,
      remaining: 45000,
      status: "due",
      pendingCount: 1,
      pendingTotal: 5000,
      canPay: false,
    });
  });

  test("TEST 5: 20000 confirmed + 5000 pending -> pending never counted, NO Pay", () => {
    const s = summarizeFee(45000, [pay(20000, "partial"), pay(5000, "pending_verification")]);
    expect(s).toMatchObject({ confirmedPaid: 20000, remaining: 25000, pendingTotal: 5000, status: "partial", canPay: false });
  });

  test("rejected payments never affect the balance and do not block Pay", () => {
    const s = summarizeFee(45000, [pay(20000, "partial"), pay(5000, "rejected")]);
    expect(s).toMatchObject({ confirmedPaid: 20000, remaining: 25000, pendingCount: 0, canPay: true });
    expect(s.rejected).toHaveLength(1);
  });

  test("two pending requests are both counted for display", () => {
    const s = summarizeFee(45000, [pay(1000, "pending_verification"), pay(2000, "pending_verification")]);
    expect(s.pendingCount).toBe(2);
    expect(s.pendingTotal).toBe(3000);
  });

  test("legacy over-recorded data never shows more than the fee (₹45300 of ₹45000)", () => {
    const s = summarizeFee(45000, [pay(45000, "paid"), pay(300, "partial")]);
    expect(s).toMatchObject({ confirmedPaid: 45000, remaining: 0, status: "paid", overpaid: true, canPay: false });
  });

  test("bad numbers never produce NaN", () => {
    const s = summarizeFee(undefined, [{ amount_paid: "abc", status: "paid" }]);
    expect(Number.isNaN(s.remaining)).toBe(false);
    expect(Number.isNaN(s.confirmedPaid)).toBe(false);
  });
});

describe("validatePaymentAmount", () => {
  const confirmed20k = [pay(20000, "partial")];

  test.each([5000, 10000, 25000])("TEST 2 allowed amount %i", (amount) => {
    expect(validatePaymentAmount({ feeAmount: 45000, payments: confirmed20k, amount })).toBeNull();
  });

  test("TEST 8: 25001 is blocked with the max message", () => {
    expect(validatePaymentAmount({ feeAmount: 45000, payments: confirmed20k, amount: 25001 })).toBe(
      "You can pay a maximum of ₹25000."
    );
  });

  test("TEST 9: a second submission while one is pending is blocked", () => {
    const msg = validatePaymentAmount({
      feeAmount: 45000,
      payments: [pay(2000, "pending_verification")],
      amount: 1000,
    });
    expect(msg).toBe(
      "A payment is already pending verification for this fee. Please wait for the administrator to verify it."
    );
  });

  test("fully paid fee blocks any payment", () => {
    expect(validatePaymentAmount({ feeAmount: 45000, payments: [pay(45000, "paid")], amount: 1 })).toMatch(/fully paid/);
  });

  test.each(["", "abc", 0, -5, NaN])("non-numeric / non-positive amount %p is rejected", (amount) => {
    expect(validatePaymentAmount({ feeAmount: 45000, payments: [], amount })).toMatch(/valid payment amount/);
  });

  test("admin record mode ignores pending requests but still blocks overpayment", () => {
    const payments = [pay(40000, "partial"), pay(2000, "pending_verification")];
    expect(validatePaymentAmount({ feeAmount: 45000, payments, amount: 5000, mode: "record" })).toBeNull();
    expect(validatePaymentAmount({ feeAmount: 45000, payments, amount: 5001, mode: "record" })).toMatch(
      /exceeds the remaining balance of ₹5000/
    );
  });

  test("approve mode blocks when the approval would overshoot the fee", () => {
    expect(
      validatePaymentAmount({ feeAmount: 45000, payments: [pay(44000, "partial")], amount: 5000, mode: "approve" })
    ).toMatch(/only ₹1000 remains/);
  });
});

describe("display helpers", () => {
  test("never prints undefined / null / NaN", () => {
    expect(display(undefined)).toBe("—");
    expect(display(null)).toBe("—");
    expect(display("")).toBe("—");
    expect(display(NaN)).toBe("—");
    expect(rupees(undefined)).toBe("₹0");
    expect(rupees("12.5x")).toBe("₹0");
  });
});
