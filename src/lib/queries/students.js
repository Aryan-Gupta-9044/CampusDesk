import { supabase } from "../supabaseClient";
import { getAdminActionClient } from "../adminActionClient";

export async function listStudents() {
  const { data, error } = await supabase
    .from("students")
    .select(
      "id, roll_no, dob, gender, address, admission_date, class_id, classes ( name, section ), profiles!students_id_fkey ( full_name, email, status )"
    )
    .order("roll_no");
  if (error) throw error;
  return data;
}

export async function getStudent(id) {
  const { data, error } = await supabase
    .from("students")
    .select("id, roll_no, dob, gender, address, admission_date, class_id, parent_id, classes ( name, section )")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

// Only for the Admin Student Detail page — embeds the linked parent's
// profile too. Kept separate from getStudent() above because a
// non-admin caller (student viewing their own fees/analytics) has no
// RLS permission to read someone else's profile row, and PostgREST
// collapses the whole result to zero rows in that case rather than
// just leaving the field blank — throwing "Cannot coerce the result
// to a single JSON object". Admin bypasses RLS entirely, so this is
// safe to use there regardless of whether profiles_rls_patch.sql has
// been applied yet.
export async function getStudentWithParent(id) {
  const { data, error } = await supabase
    .from("students")
    .select(
      "id, roll_no, dob, gender, address, admission_date, class_id, parent_id, classes ( name, section, academic_year ), profiles!students_id_fkey ( full_name, email, phone, status ), parent:profiles!students_parent_id_fkey ( id, full_name, email, phone, status )"
    )
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

export async function createStudent({ fullName, email, password, phone, rollNo, classId, dob, gender, address }) {
  const { data: signUpData, error: signUpError } = await getAdminActionClient().auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName, role: "student" } },
  });
  if (signUpError) throw signUpError;

  const userId = signUpData.user.id;

  if (phone && phone.trim()) {
    const { error: phoneError } = await supabase.from("profiles").update({ phone: phone.trim() }).eq("id", userId);
    if (phoneError) throw phoneError;
  }

  const { error: insertError } = await supabase.from("students").insert({
    id: userId,
    roll_no: rollNo || null,
    class_id: classId || null,
    dob: dob || null,
    gender: gender || null,
    address: address || null,
  });
  if (insertError) throw insertError;

  return userId;
}

export async function updateStudent(id, { fullName, phone, rollNo, classId, dob, gender, address }) {
  const { error: profileError } = await supabase
    .from("profiles")
    .update({ full_name: fullName, phone: phone && phone.trim() ? phone.trim() : null })
    .eq("id", id);
  if (profileError) throw profileError;

  const { error: studentError } = await supabase
    .from("students")
    .update({
      roll_no: rollNo || null,
      class_id: classId || null,
      dob: dob || null,
      gender: gender || null,
      address: address || null,
    })
    .eq("id", id);
  if (studentError) throw studentError;
}

export async function setStudentStatus(id, status) {
  const { error } = await supabase.from("profiles").update({ status }).eq("id", id);
  if (error) throw error;
}

export async function findParentByEmail(email) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("email", email)
    .eq("role", "parent")
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function setStudentParent(studentId, parentId) {
  const { error } = await supabase.from("students").update({ parent_id: parentId }).eq("id", studentId);
  if (error) throw error;
}

export async function createParentAndLink(studentId, { fullName, email, password, phone }) {
  const { data: signUpData, error: signUpError } = await getAdminActionClient().auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName, role: "parent" } },
  });
  if (signUpError) throw signUpError;

  const parentId = signUpData.user.id;
  if (phone && phone.trim()) {
    const { error: phoneError } = await supabase.from("profiles").update({ phone: phone.trim() }).eq("id", parentId);
    if (phoneError) throw phoneError;
  }

  await setStudentParent(studentId, parentId);
  return parentId;
}

export async function updateProfilePhone(profileId, phone) {
  const { error } = await supabase
    .from("profiles")
    .update({ phone: phone && phone.trim() ? phone.trim() : null })
    .eq("id", profileId);
  if (error) throw error;
}

// One loader for every student report (admin full report, student's own
// report, parent's report for their child). It uses separate small queries
// rather than one deep embed so a row the viewer isn't allowed to read (RLS)
// becomes a blank section instead of collapsing the whole page.
// Student ID shown in reports is the profile/student UUID — the app's only ID.
export async function getStudentReportProfile(studentId) {
  const { data: student, error } = await supabase
    .from("students")
    .select(
      "id, roll_no, dob, gender, address, admission_date, class_id, parent_id, classes ( id, name, section, academic_year, class_teacher_id )"
    )
    .eq("id", studentId)
    .maybeSingle();
  if (error) throw error;
  if (!student) throw new Error("Student record not found, or you do not have access to it.");

  const profileSelect = "id, full_name, email, phone, status";

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select(profileSelect)
    .eq("id", studentId)
    .maybeSingle();
  if (profileError) throw profileError;

  let parent = null;
  if (student.parent_id) {
    const { data } = await supabase.from("profiles").select(profileSelect).eq("id", student.parent_id).maybeSingle();
    parent = data || null;
  }

  let classTeacher = null;
  const classTeacherId = student.classes?.class_teacher_id;
  if (classTeacherId) {
    const { data } = await supabase
      .from("teachers")
      .select("id, employee_id, department, qualification, joining_date, profiles ( full_name, email, phone, status )")
      .eq("id", classTeacherId)
      .maybeSingle();
    classTeacher = data || null;
  }

  return { student, profile: profile || null, parent, parentLinked: Boolean(student.parent_id), classTeacher };
}
