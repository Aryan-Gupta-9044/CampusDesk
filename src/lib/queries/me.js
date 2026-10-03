import { supabase } from "../supabaseClient";

export async function getStudentIdForParent(parentUserId) {
  const { data, error } = await supabase
    .from("students")
    .select("id")
    .eq("parent_id", parentUserId)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.id || null;
}
