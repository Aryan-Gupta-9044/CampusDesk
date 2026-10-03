import { supabase } from "../supabaseClient";
import { getAdminActionClient } from "../adminActionClient";

export async function listTeachers() {
  const { data, error } = await supabase
    .from("teachers")
    .select("id, employee_id, department, qualification, joining_date, profiles ( full_name, email, phone, status )")
    .order("employee_id");
  if (error) throw error;
  return data;
}

export async function getTeacher(id) {
  const { data, error } = await supabase
    .from("teachers")
    .select("id, employee_id, department, qualification, joining_date, profiles ( full_name, email, phone, status )")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

export async function createTeacher({ fullName, email, password, phone, employeeId, department, qualification, joiningDate }) {
  const { data: signUpData, error: signUpError } = await getAdminActionClient().auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName, role: "teacher" } },
  });
  if (signUpError) throw signUpError;

  const userId = signUpData.user.id;

  if (phone && phone.trim()) {
    const { error: phoneError } = await supabase.from("profiles").update({ phone: phone.trim() }).eq("id", userId);
    if (phoneError) throw phoneError;
  }

  const { error: insertError } = await supabase.from("teachers").insert({
    id: userId,
    employee_id: employeeId || null,
    department: department || null,
    qualification: qualification || null,
    joining_date: joiningDate || null,
  });
  if (insertError) throw insertError;

  return userId;
}

export async function updateTeacher(id, { fullName, phone, employeeId, department, qualification, joiningDate }) {
  const { error: profileError } = await supabase
    .from("profiles")
    .update({ full_name: fullName, phone: phone && phone.trim() ? phone.trim() : null })
    .eq("id", id);
  if (profileError) throw profileError;

  const { error: teacherError } = await supabase
    .from("teachers")
    .update({
      employee_id: employeeId || null,
      department: department || null,
      qualification: qualification || null,
      joining_date: joiningDate || null,
    })
    .eq("id", id);
  if (teacherError) throw teacherError;
}

export async function setTeacherStatus(id, status) {
  const { error } = await supabase.from("profiles").update({ status }).eq("id", id);
  if (error) throw error;
}
