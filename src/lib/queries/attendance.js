import { supabase } from "../supabaseClient";

export async function listMyTeachingAssignments(teacherId) {
  const { data, error } = await supabase
    .from("teacher_subjects")
    .select("id, class_id, subject_id, classes ( name, section ), subjects ( name )")
    .eq("teacher_id", teacherId);
  if (error) throw error;
  return data;
}

export async function listClassRosterWithAttendance(classId, subjectId, date) {
  const { data: students, error: studentsError } = await supabase
    .from("students")
    .select("id, roll_no, profiles!students_id_fkey ( full_name )")
    .eq("class_id", classId)
    .order("roll_no");
  if (studentsError) throw studentsError;

  const { data: attendanceRows, error: attendanceError } = await supabase
    .from("attendance")
    .select("id, student_id, status")
    .eq("class_id", classId)
    .eq("subject_id", subjectId)
    .eq("date", date);
  if (attendanceError) throw attendanceError;

  const statusByStudent = Object.fromEntries((attendanceRows || []).map((row) => [row.student_id, row.status]));

  return students.map((s) => ({
    ...s,
    status: statusByStudent[s.id] || "present",
  }));
}

export async function saveAttendance(classId, subjectId, date, records, markedBy) {
  const rows = records.map((r) => ({
    student_id: r.id,
    class_id: classId,
    subject_id: subjectId,
    date,
    status: r.status,
    marked_by: markedBy,
  }));
  const { error } = await supabase
    .from("attendance")
    .upsert(rows, { onConflict: "student_id,subject_id,date" });
  if (error) throw error;
}

export async function listMyAttendanceHistory(studentId) {
  const { data, error } = await supabase
    .from("attendance")
    .select("id, date, status, subjects ( name )")
    .eq("student_id", studentId)
    .order("date", { ascending: false })
    .limit(60);
  if (error) throw error;
  return data;
}

export async function listAttendanceForClassAdmin(classId, date) {
  let query = supabase
    .from("attendance")
    .select("id, date, status, subjects ( name ), students ( roll_no, profiles!students_id_fkey ( full_name ) )")
    .order("date", { ascending: false })
    .limit(100);
  if (classId) query = query.eq("class_id", classId);
  if (date) query = query.eq("date", date);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}
