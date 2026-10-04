/**
 * @jest-environment ./src/integration/nodeEnvWithFetch.js
 *
 * Optional integration test: runs the app's REAL query modules through the
 * real supabase-js client against a real PostgREST + Postgres that has the
 * project's SQL files loaded (schema + patches + seed). Skipped unless
 * PGRST_URL is set, so a plain `npm test` stays self-contained.
 *
 *   PGRST_URL=http://localhost:3111 PGRST_JWT_SECRET=... npm test -- --watchAll=false integration
 */
const crypto = require("crypto");

const URL_ = process.env.PGRST_URL;
const SECRET = process.env.PGRST_JWT_SECRET || "super-secret-jwt-token-with-at-least-32-characters-long";
const d = URL_ ? describe : describe.skip;

let mockCurrent = null;
const mockClients = {};

function b64(o) {
  return Buffer.from(typeof o === "string" ? o : JSON.stringify(o)).toString("base64url");
}
function jwtFor(sub) {
  const head = b64({ alg: "HS256", typ: "JWT" });
  const body = b64({ sub, role: "authenticated", aud: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 });
  const sig = crypto.createHmac("sha256", SECRET).update(`${head}.${body}`).digest("base64url");
  return `${head}.${body}.${sig}`;
}

jest.mock("../lib/supabaseClient", () => {
  const { createClient } = require("@supabase/supabase-js");
  const make = (sub) =>
    createClient("http://fake.local", "anon-key", {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        headers: { Authorization: `Bearer ${global.__jwtFor(sub)}` },
        fetch: (url, init) => fetch(String(url).replace("http://fake.local/rest/v1", process.env.PGRST_URL), init),
      },
    });
  return {
    supabase: new Proxy(
      {},
      {
        get: (_t, prop) => {
          const id = global.__current;
          if (!global.__clients[id]) global.__clients[id] = make(id);
          const c = global.__clients[id];
          const v = c[prop];
          return typeof v === "function" ? v.bind(c) : v;
        },
      }
    ),
  };
});

global.__jwtFor = jwtFor;
global.__clients = mockClients;

const Q = (m) => require(`../lib/queries/${m}`);

const ADMIN = "00000000-0000-0000-0000-0000000000ad";
const as = (id) => {
  mockCurrent = id;
  global.__current = id;
};
const ids = {};

async function rest(path) {
  const r = await fetch(`${URL_}${path}`, { headers: { Authorization: `Bearer ${jwtFor(ADMIN)}` } });
  const body = await r.json();
  if (!Array.isArray(body)) throw new Error(`REST ${path} -> ${JSON.stringify(body)}`);
  return body;
}

d("CampusDesk query layer against real PostgREST + RLS", () => {
  beforeAll(async () => {
    as(ADMIN);
    const profs = await rest("/profiles?select=id,email,role");
    const byEmail = Object.fromEntries(profs.map((p) => [p.email, p.id]));
    ids.aarav = byEmail["aarav@gmail.com"];
    ids.vivaan = byEmail["vivaan@gmail.com"];
    ids.aaravParent = byEmail["aaravparent@gmail.com"];
    ids.vivaanParent = byEmail["vivaanparent@gmail.com"];
    ids.anita = byEmail["anita@gmail.com"];
    const st = await rest(`/students?select=id,class_id,parent_id&id=in.(${ids.aarav},${ids.vivaan})`);
    ids.aaravClass = st.find((s) => s.id === ids.aarav).class_id;
    ids.vivaanClass = st.find((s) => s.id === ids.vivaan).class_id;
    const ts = await rest(`/teacher_subjects?select=id,class_id,subject_id,teacher_id&teacher_id=eq.${ids.anita}`);
    ids.anitaAssign = ts[0];
  });

  test("seed sanity", () => {
    ["aarav", "vivaan", "aaravParent", "vivaanParent", "anita"].forEach((k) => expect(ids[k]).toBeTruthy());
  });

  describe("admin: every read screen", () => {
    beforeEach(() => as(ADMIN));
    const reads = {
      "students.listStudents": () => Q("students").listStudents(),
      "students.getStudent": () => Q("students").getStudent(ids.aarav),
      "students.getStudentWithParent": () => Q("students").getStudentWithParent(ids.aarav),
      "students.getStudentReportProfile": () => Q("students").getStudentReportProfile(ids.aarav),
      "teachers.listTeachers": () => Q("teachers").listTeachers(),
      "teachers.getTeacher": () => Q("teachers").getTeacher(ids.anita),
      "classes.listClasses": () => Q("classes").listClasses(),
      "classes.listSubjects": () => Q("classes").listSubjects(ids.aaravClass),
      "classes.listActiveTeachersForDropdown": () => Q("classes").listActiveTeachersForDropdown(),
      "classes.listSubjectTeachers": () => Q("classes").listSubjectTeachers(ids.anitaAssign.subject_id),
      "fees.listFeeStructures": () => Q("fees").listFeeStructures(),
      "fees.listStudentsForClass": () => Q("fees").listStudentsForClass(ids.aaravClass),
      "fees.listPendingPaymentRequests": () => Q("fees").listPendingPaymentRequests(),
      "fees.listMyFeeStatus": () => Q("fees").listMyFeeStatus(ids.aarav, ids.aaravClass),
      "fees.getFeeBalance": async () => {
        const [fs] = await Q("fees").listFeeStructures();
        await Q("fees").listPaymentsForFeeStructure(fs.id);
        return Q("fees").getFeeBalance(ids.aarav, fs.id);
      },
      "leave.listAllLeaveRequestsForAdmin": () => Q("leave").listAllLeaveRequestsForAdmin(),
      "notices.listNotices": () => Q("notices").listNotices(),
      "events.listEvents": () => Q("events").listEvents(),
      "audit.listAuditLogs": () => Q("audit").listAuditLogs(),
      "activity.listRecentActivity": () => Q("activity").listRecentActivity("admin", ADMIN),
      "analytics.getInstitutionOverview": () => Q("analytics").getInstitutionOverview(),
      "attendance.listAttendanceForClassAdmin": () => Q("attendance").listAttendanceForClassAdmin(ids.aaravClass),
      "exams.listExamsForClass": () => Q("exams").listExamsForClass(ids.aaravClass),
      "timetable.listTimetableForClass": () => Q("timetable").listTimetableForClass(ids.aaravClass),
      "academicReport.attendance": () => Q("academicReport").getSubjectAttendanceBreakdown(ids.aarav),
      "academicReport.marks": () => Q("academicReport").getAllMarksBreakdown(ids.aarav),
      "academicReport.teacher": () => Q("academicReport").getTeacherSubjectBreakdown(ids.anita),
      "analytics.student*": async () => {
        await Q("analytics").getStudentAttendanceSummary(ids.aarav);
        await Q("analytics").getStudentResultsTrend(ids.aarav);
        return Q("analytics").getStudentFeeSummary(ids.aarav, ids.aaravClass);
      },
      "analytics.getTeacherClassSummaries": () => Q("analytics").getTeacherClassSummaries(ids.anita),
    };
    test.each(Object.keys(reads))("%s", async (name) => {
      const out = await reads[name]();
      expect(out).toBeDefined();
    });

    test("student full report has parent + class teacher + phones", async () => {
      const r = await Q("students").getStudentReportProfile(ids.aarav);
      expect(r.profile.email).toBe("aarav@gmail.com");
      expect(r.profile.phone).toBeTruthy();
      expect(r.parent.email).toBe("aaravparent@gmail.com");
      expect(r.parent.phone).toBeTruthy();
      expect(r.classTeacher.employee_id).toBeTruthy();
      expect(r.classTeacher.profiles.phone).toBeTruthy();
    });

    test("student without parent / class without teacher render cleanly", async () => {
      const all = await Q("students").listStudents();
      const [noParent] = await rest("/students?select=id&parent_id=is.null");
      expect(noParent).toBeTruthy();
      const r = await Q("students").getStudentReportProfile(noParent.id);
      expect(r.parentLinked).toBe(false);
      expect(r.parent).toBeNull();
      const noTeacherClass = (await Q("classes").listClasses()).find((c) => !c.class_teacher_id);
      const stu = all.find((s) => s.class_id === noTeacherClass.id);
      const r2 = await Q("students").getStudentReportProfile(stu.id);
      expect(r2.classTeacher).toBeNull();
    });
  });

  describe("admin: write flows", () => {
    beforeEach(() => as(ADMIN));

    test("class + subject + teacher assignment + timetable CRUD", async () => {
      await Q("classes").addClass({ name: "99", section: "Z", academicYear: "2026-27", classTeacherId: ids.anita });
      const cls = (await Q("classes").listClasses()).find((c) => c.name === "99" && c.section === "Z");
      expect(cls).toBeTruthy();
      await Q("classes").updateClass(cls.id, { name: "99", section: "Y", academicYear: "2026-27", classTeacherId: null });
      await Q("classes").addSubject(cls.id, { name: "Test Subj", code: "TST" });
      const [sub] = await Q("classes").listSubjects(cls.id);
      await Q("classes").updateSubject(sub.id, { name: "Test Subj 2", code: "TS2" });
      await Q("classes").assignTeacherToSubject(sub.id, cls.id, ids.anita);
      const [ts] = await Q("classes").listSubjectTeachers(sub.id);
      expect(ts.teacher_id).toBe(ids.anita);
      await Q("timetable").addTimetableEntry({
        classId: cls.id, subjectId: sub.id, teacherId: ids.anita, dayOfWeek: 1, startTime: "09:00", endTime: "09:45",
      });
      const tt = await Q("timetable").listTimetableForClass(cls.id);
      expect(tt).toHaveLength(1);
      await Q("timetable").deleteTimetableEntry(tt[0].id);
      await Q("classes").unassignTeacherFromSubject(ts.id);
      await Q("classes").deleteSubject(sub.id);
      await Q("classes").deleteClass(cls.id);
      expect((await Q("classes").listClasses()).find((c) => c.id === cls.id)).toBeUndefined();
    });

    test("notices + events CRUD", async () => {
      await Q("notices").createNotice({ title: "ZZ test notice", content: "c", targetRole: "all", pinned: true });
      const n = (await Q("notices").listNotices()).find((x) => x.title === "ZZ test notice");
      expect(n).toBeTruthy();
      await Q("notices").deleteNotice(n.id);
      await Q("events").createEvent({ title: "ZZ test event", description: "d", eventDate: "2026-12-01", location: "Hall" });
      const e = (await Q("events").listEvents()).find((x) => x.title === "ZZ test event");
      expect(e).toBeTruthy();
      await Q("events").deleteEvent(e.id);
    });

    test("fee structure CRUD, manual payment, audit log", async () => {
      await Q("fees").addFeeStructure({ classId: ids.aaravClass, academicYear: "2026-27", feeType: "ZZ Fee", amount: 1000, dueDate: "2026-12-31" });
      const fs = (await Q("fees").listFeeStructures()).find((f) => f.fee_type === "ZZ Fee");
      expect(fs).toBeTruthy();
      const r = await Q("fees").recordPayment({
        studentId: ids.aarav, feeStructureId: fs.id, amountPaid: 400, mode: "cash", receiptNo: "ZZ1", recordedBy: ADMIN,
      });
      expect(r).toMatchObject({ status: "partial", remaining: 600 });
      await expect(
        Q("fees").recordPayment({ studentId: ids.aarav, feeStructureId: fs.id, amountPaid: 700, mode: "cash", recordedBy: ADMIN })
      ).rejects.toThrow(/exceeds/);
      await Q("audit").logAction(ADMIN, "test_action", "fee_structure", fs.id, { a: 1 });
      const logs = await Q("audit").listAuditLogs(20);
      expect(logs.some((l) => l.action === "test_action")).toBe(true);
    });

    test("exam CRUD", async () => {
      await Q("exams").createExam({ name: "ZZ Exam", classId: ids.aaravClass, term: "Term 9", startDate: "2026-12-01", endDate: "2026-12-05" });
      const ex = (await Q("exams").listExamsForClass(ids.aaravClass)).find((e) => e.name === "ZZ Exam");
      expect(ex).toBeTruthy();
      await Q("exams").deleteExam(ex.id);
    });

    test("student/teacher profile edits incl. phone", async () => {
      await Q("students").updateStudent(ids.aarav, { fullName: "Aarav Edited", phone: "9123456789", rollNo: undefined, classId: ids.aaravClass });
      const s = await Q("students").getStudentWithParent(ids.aarav);
      expect(s.profiles.phone).toBe("9123456789");
      await Q("teachers").updateTeacher(ids.anita, { fullName: "Anita Sharma", phone: "9876500000", employeeId: undefined, department: "Maths", qualification: "M.Sc", joiningDate: null });
      const t = await Q("teachers").getTeacher(ids.anita);
      expect(t.profiles.phone).toBe("9876500000");
      await Q("students").setStudentStatus(ids.aarav, "suspended");
      await Q("students").setStudentStatus(ids.aarav, "active");
    });
  });

  describe("student A", () => {
    beforeEach(() => as(ids.aarav));

    test("own data loads", async () => {
      await Q("students").getStudent(ids.aarav);
      const rep = await Q("students").getStudentReportProfile(ids.aarav);
      expect(rep.parent.email).toBe("aaravparent@gmail.com");
      expect(rep.classTeacher.profiles.full_name).toBeTruthy();
      await Q("fees").listMyFeeStatus(ids.aarav, ids.aaravClass);
      await Q("attendance").listMyAttendanceHistory(ids.aarav);
      await Q("exams").listMyResults(ids.aarav);
      await Q("academicReport").getSubjectAttendanceBreakdown(ids.aarav);
      await Q("academicReport").getAllMarksBreakdown(ids.aarav);
      await Q("notices").listNotices();
      await Q("events").listEvents();
      await Q("timetable").listTimetableForClass(ids.aaravClass);
      await Q("teacherQueries").listTeachersForClass(ids.aaravClass);
      await Q("activity").listRecentActivity("student", ids.aarav);
      await Q("analytics").getStudentFeeSummary(ids.aarav, ids.aaravClass);
    });

    test("cannot see Student B anywhere", async () => {
      await expect(Q("students").getStudentReportProfile(ids.vivaan)).rejects.toThrow();
      expect(await Q("academicReport").getAllMarksBreakdown(ids.vivaan)).toHaveLength(0);
      expect(await Q("academicReport").getSubjectAttendanceBreakdown(ids.vivaan)).toHaveLength(0);
      const fees = await Q("fees").listMyFeeStatus(ids.vivaan, ids.vivaanClass);
      fees.forEach((f) => expect(f.payments).toHaveLength(0));
      expect(await Q("attendance").listMyAttendanceHistory(ids.vivaan)).toHaveLength(0);
      expect(await Q("leave").listMyLeaveRequests(ids.vivaan)).toHaveLength(0);
    });

    test("leave + teacher query + own phone", async () => {
      await Q("leave").createLeaveRequest({ fromDate: "2026-11-02", toDate: "2026-11-03", reason: "ZZ fever" }, ids.aarav, "student");
      const mine = await Q("leave").listMyLeaveRequests(ids.aarav);
      expect(mine.some((l) => l.reason === "ZZ fever")).toBe(true);
      const teachers = await Q("teacherQueries").listTeachersForClass(ids.aaravClass);
      expect(teachers.length).toBeGreaterThan(0);
      await Q("teacherQueries").createQuery({
        studentId: ids.aarav, senderId: ids.aarav, senderRole: "student", teacherId: teachers[0].id, queryType: "doubt", message: "ZZ query",
      });
      const sent = await Q("teacherQueries").listMySentQueries(ids.aarav);
      expect(sent.some((q) => q.message === "ZZ query")).toBe(true);
      await Q("account").updateMyProfile(ids.aarav, { fullName: "Aarav Edited", phone: "9000011111" });
    });
  });

  describe("parent A", () => {
    beforeEach(() => as(ids.aaravParent));

    test("linked child resolves and loads", async () => {
      expect(await Q("me").getStudentIdForParent(ids.aaravParent)).toBe(ids.aarav);
      const rep = await Q("students").getStudentReportProfile(ids.aarav);
      expect(rep.profile.full_name).toBeTruthy();
      expect(rep.parent.id).toBe(ids.aaravParent);
      expect(rep.classTeacher).toBeTruthy();
      await Q("fees").listMyFeeStatus(ids.aarav, ids.aaravClass);
      await Q("academicReport").getAllMarksBreakdown(ids.aarav);
      await Q("attendance").listMyAttendanceHistory(ids.aarav);
      await Q("leave").createLeaveRequest({ fromDate: "2026-11-05", toDate: "2026-11-05", reason: "ZZ parent leave" }, ids.aaravParent, "parent");
    });

    test("cannot reach another family", async () => {
      await expect(Q("students").getStudentReportProfile(ids.vivaan)).rejects.toThrow();
      expect(await Q("academicReport").getAllMarksBreakdown(ids.vivaan)).toHaveLength(0);
      const fees = await Q("fees").listMyFeeStatus(ids.vivaan, ids.vivaanClass);
      fees.forEach((f) => expect(f.payments).toHaveLength(0));
      await expect(
        Q("fees").submitPaymentRequest({ studentId: ids.vivaan, feeStructureId: fees[0].id, amountPaid: 10, mode: "upi" })
      ).rejects.toThrow();
    });
  });

  describe("fee workflow end-to-end through real RLS", () => {
    test("student -> pending -> parent sees same -> duplicate blocked -> admin reject -> pay -> approve", async () => {
      as(ids.aarav);
      let [tuition] = (await Q("fees").listMyFeeStatus(ids.aarav, ids.aaravClass)).filter((f) => f.fee_type === "Tuition Fee");
      // Make the starting state deterministic: admin approves/rejects anything already pending.
      as(ADMIN);
      for (const p of tuition.pending) await Q("fees").verifyPaymentRequest(p.id, "reject");
      as(ids.aarav);
      [tuition] = (await Q("fees").listMyFeeStatus(ids.aarav, ids.aaravClass)).filter((f) => f.fee_type === "Tuition Fee");
      expect(tuition.canPay).toBe(tuition.remaining > 0);
      const before = tuition.paidTotal;

      await Q("fees").submitPaymentRequest({ studentId: ids.aarav, feeStructureId: tuition.id, amountPaid: 2000, mode: "upi", note: "ZZ ref" });

      [tuition] = (await Q("fees").listMyFeeStatus(ids.aarav, ids.aaravClass)).filter((f) => f.fee_type === "Tuition Fee");
      expect(tuition).toMatchObject({ paidTotal: before, pendingCount: 1, pendingTotal: 2000, canPay: false });
      await expect(
        Q("fees").submitPaymentRequest({ studentId: ids.aarav, feeStructureId: tuition.id, amountPaid: 100, mode: "upi" })
      ).rejects.toThrow(/already pending/);

      as(ids.aaravParent);
      const [forParent] = (await Q("fees").listMyFeeStatus(ids.aarav, ids.aaravClass)).filter((f) => f.fee_type === "Tuition Fee");
      expect(forParent).toMatchObject({ pendingCount: 1, canPay: false });
      await expect(
        Q("fees").submitPaymentRequest({ studentId: ids.aarav, feeStructureId: tuition.id, amountPaid: 100, mode: "upi" })
      ).rejects.toThrow(/already pending/);

      as(ADMIN);
      const queue = await Q("fees").listPendingPaymentRequests();
      const req = queue.find((r) => r.student_id === ids.aarav && r.fee_structure_id === tuition.id);
      expect(req.students.profiles.full_name).toBeTruthy();
      expect(req.students.classes.name).toBeTruthy();
      expect(req.fee_structure.fee_type).toBe("Tuition Fee");
      await Q("fees").verifyPaymentRequest(req.id, "reject", { approvedBy: ADMIN });
      await expect(Q("fees").verifyPaymentRequest(req.id, "approve", { approvedBy: ADMIN })).rejects.toThrow(/already been processed/);

      as(ids.aarav);
      [tuition] = (await Q("fees").listMyFeeStatus(ids.aarav, ids.aaravClass)).filter((f) => f.fee_type === "Tuition Fee");
      expect(tuition).toMatchObject({ paidTotal: before, pendingCount: 0, canPay: tuition.remaining > 0 });

      await Q("fees").submitPaymentRequest({ studentId: ids.aarav, feeStructureId: tuition.id, amountPaid: 1500, mode: "cash" });
      as(ADMIN);
      const second = (await Q("fees").listPendingPaymentRequests()).find((r) => r.student_id === ids.aarav && r.fee_structure_id === tuition.id);
      await Q("fees").verifyPaymentRequest(second.id, "approve", { approvedBy: ADMIN });
      as(ids.aarav);
      [tuition] = (await Q("fees").listMyFeeStatus(ids.aarav, ids.aaravClass)).filter((f) => f.fee_type === "Tuition Fee");
      expect(tuition.paidTotal).toBe(before + 1500);
      expect(tuition.pendingCount).toBe(0);
    });
  });

  describe("teacher", () => {
    beforeEach(() => as(ids.anita));

    test("teaching screens load and write", async () => {
      const assigns = await Q("attendance").listMyTeachingAssignments(ids.anita);
      expect(assigns.length).toBeGreaterThan(0);
      const { class_id, subject_id } = assigns[0];
      const date = "2026-10-01";
      const roster = await Q("attendance").listClassRosterWithAttendance(class_id, subject_id, date);
      expect(roster.length).toBeGreaterThan(0);
      await Q("attendance").saveAttendance(class_id, subject_id, date, roster.map((r, i) => ({ id: r.id, status: i % 2 ? "absent" : "present" })), ids.anita);
      const again = await Q("attendance").listClassRosterWithAttendance(class_id, subject_id, date);
      expect(again.some((r) => r.status === "absent")).toBe(true);

      const exams = await Q("exams").listExamsForTeacher(ids.anita);
      expect(exams.length).toBeGreaterThan(0);
      const exam = exams.find((e) => e.class_id === class_id) || exams[0];
      const subs = await Q("exams").listMySubjectsForClass(ids.anita, exam.class_id);
      const mroster = await Q("exams").listMarksRoster(exam.id, exam.class_id, subs[0].subject_id);
      await Q("exams").saveMarks(exam.id, subs[0].subject_id, mroster.map((r) => ({ id: r.id, marksObtained: 70, maxMarks: 100 })), ids.anita);
      // Publishing results is admin-only by design (RLS) — teachers must be refused.
      await expect(Q("exams").computeAndPublishResults(exam.id, exam.class_id)).rejects.toMatchObject({ code: "42501" });
      as(ADMIN);
      await Q("exams").computeAndPublishResults(exam.id, exam.class_id);
      expect((await Q("exams").listResultsForExam(exam.id)).length).toBeGreaterThan(0);
      as(ids.anita);

      await Q("timetable").listMyTimetable(ids.anita);
      await Q("analytics").getTeacherClassSummaries(ids.anita);
      await Q("academicReport").getTeacherSubjectBreakdown(ids.anita);
      await Q("leave").listPendingStudentLeaveForTeacher();
      await Q("activity").listRecentActivity("teacher", ids.anita);
    });

    test("student leave approval + query reply", async () => {
      const pending = (await Q("leave").listPendingStudentLeaveForTeacher()).filter((l) => l.status === "pending");
      if (pending.length) {
        expect(pending[0].profiles.full_name).toBeTruthy();
        await Q("leave").setLeaveStatus(pending[0].id, "approved", ids.anita);
      }
      const qs = await Q("teacherQueries").listQueriesForTeacher(ids.anita);
      const open = qs.find((q) => q.message === "ZZ query") || qs.find((q) => q.status === "open");
      if (open) {
        expect(open.students.profiles.full_name).toBeTruthy();
        await Q("teacherQueries").replyToQuery(open.id, "ZZ reply");
      }
    });

    test("teacher cannot touch fees", async () => {
      expect(await Q("fees").listPendingPaymentRequests()).toHaveLength(0);
    });
  });
});
