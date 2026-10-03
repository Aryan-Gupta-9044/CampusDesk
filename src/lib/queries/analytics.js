import { supabase } from "../supabaseClient";
import { summarizeFee, isConfirmed, toAmount } from "../feeCalc";

// ---------- Student / Parent ----------

export async function getStudentAttendanceSummary(studentId) {
  const { data, error } = await supabase.from("attendance").select("status").eq("student_id", studentId);
  if (error) throw error;
  const counts = { present: 0, absent: 0, late: 0, leave: 0 };
  (data || []).forEach((r) => {
    counts[r.status] = (counts[r.status] || 0) + 1;
  });
  const total = data?.length || 0;
  return { total, counts, percentage: total ? Math.round((counts.present / total) * 100) : 0 };
}

export async function getStudentResultsTrend(studentId) {
  const { data, error } = await supabase
    .from("results")
    .select("percentage, grade, exams ( name )")
    .eq("student_id", studentId)
    .eq("published", true)
    .order("id");
  if (error) throw error;
  return data;
}

export async function getStudentFeeSummary(studentId, classId) {
  if (!classId) return { totalDue: 0, totalPaid: 0, remaining: 0, pendingCount: 0 };
  const { data: structures, error: e1 } = await supabase.from("fee_structure").select("id, amount").eq("class_id", classId);
  if (e1) throw e1;
  const { data: payments, error: e2 } = await supabase
    .from("fee_payments")
    .select("fee_structure_id, amount_paid, status")
    .eq("student_id", studentId);
  if (e2) throw e2;

  // Same rules as the Fees page: only confirmed payments count, per fee item.
  let totalDue = 0;
  let totalPaid = 0;
  let remaining = 0;
  let pendingCount = 0;
  (structures || []).forEach((s) => {
    const sum = summarizeFee(s.amount, (payments || []).filter((p) => p.fee_structure_id === s.id));
    totalDue += sum.total;
    totalPaid += sum.confirmedPaid;
    remaining += sum.remaining;
    pendingCount += sum.pendingCount;
  });
  return { totalDue, totalPaid, remaining, pendingCount };
}

// ---------- Teacher ----------

export async function getTeacherClassSummaries(teacherId) {
  const { data: assignments, error } = await supabase
    .from("teacher_subjects")
    .select("class_id, subject_id, classes ( name, section ), subjects ( name )")
    .eq("teacher_id", teacherId);
  if (error) throw error;

  const summaries = [];
  for (const a of assignments || []) {
    const { data: att } = await supabase
      .from("attendance")
      .select("status")
      .eq("class_id", a.class_id)
      .eq("subject_id", a.subject_id);
    const totalAtt = att?.length || 0;
    const presentAtt = att?.filter((r) => r.status === "present").length || 0;

    const { data: marksRows } = await supabase
      .from("marks")
      .select("marks_obtained, max_marks")
      .eq("subject_id", a.subject_id);
    const avgPct =
      marksRows && marksRows.length
        ? Math.round(
            marksRows.reduce((s, m) => s + (Number(m.marks_obtained) / Number(m.max_marks)) * 100, 0) / marksRows.length
          )
        : 0;

    summaries.push({
      label: `${a.classes?.name}-${a.classes?.section} · ${a.subjects?.name}`,
      attendancePct: totalAtt ? Math.round((presentAtt / totalAtt) * 100) : 0,
      avgMarksPct: avgPct,
    });
  }
  return summaries;
}

// ---------- Admin ----------

export async function getInstitutionOverview() {
  const [{ count: studentCount }, { count: teacherCount }, { data: classesData }] = await Promise.all([
    supabase.from("students").select("id", { count: "exact", head: true }),
    supabase.from("teachers").select("id", { count: "exact", head: true }),
    supabase.from("classes").select("id, name, section"),
  ]);

  const { data: allStudents } = await supabase.from("students").select("id, class_id");
  const { data: attendance } = await supabase.from("attendance").select("status, class_id");
  const { data: marks } = await supabase.from("marks").select("marks_obtained, max_marks, students ( class_id )");
  const { data: feeStructures } = await supabase.from("fee_structure").select("amount, class_id");
  const { data: feePayments } = await supabase.from("fee_payments").select("amount_paid, status");
  const { count: pendingLeaveCount } = await supabase
    .from("leave_requests")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");

  const studentCountByClass = {};
  (allStudents || []).forEach((s) => {
    studentCountByClass[s.class_id] = (studentCountByClass[s.class_id] || 0) + 1;
  });

  const totalAtt = attendance?.length || 0;
  const presentAtt = attendance?.filter((r) => r.status === "present").length || 0;
  const overallAttendancePct = totalAtt ? Math.round((presentAtt / totalAtt) * 100) : 0;

  const classPerf = (classesData || []).map((c) => {
    const classAtt = (attendance || []).filter((a) => a.class_id === c.id);
    const classPresent = classAtt.filter((a) => a.status === "present").length;
    const attPct = classAtt.length ? Math.round((classPresent / classAtt.length) * 100) : 0;

    const classMarks = (marks || []).filter((m) => m.students?.class_id === c.id);
    const avgPct = classMarks.length
      ? Math.round(
          classMarks.reduce((s, m) => s + (Number(m.marks_obtained) / Number(m.max_marks)) * 100, 0) / classMarks.length
        )
      : 0;

    return { label: `${c.name}-${c.section}`, attendancePct: attPct, avgMarksPct: avgPct };
  });

  const totalFeeExpected = (feeStructures || []).reduce(
    (sum, f) => sum + Number(f.amount) * (studentCountByClass[f.class_id] || 0),
    0
  );
  const totalFeeCollected = (feePayments || []).filter(isConfirmed).reduce((s, p) => s + toAmount(p.amount_paid), 0);

  return {
    studentCount: studentCount || 0,
    teacherCount: teacherCount || 0,
    classCount: classesData?.length || 0,
    overallAttendancePct,
    classPerf,
    totalFeeExpected,
    totalFeeCollected,
    pendingLeaveCount: pendingLeaveCount || 0,
  };
}
