import { supabase } from "../supabaseClient";

export async function listTimetableForClass(classId) {
  const { data, error } = await supabase
    .from("timetable")
    .select("id, day_of_week, start_time, end_time, subjects ( name ), teachers ( id, profiles ( full_name ) )")
    .eq("class_id", classId)
    .order("day_of_week")
    .order("start_time");
  if (error) throw error;
  return data;
}

export async function listMyTimetable(teacherId) {
  const { data, error } = await supabase
    .from("timetable")
    .select("id, day_of_week, start_time, end_time, classes ( name, section ), subjects ( name )")
    .eq("teacher_id", teacherId)
    .order("day_of_week")
    .order("start_time");
  if (error) throw error;
  return data;
}

export async function addTimetableEntry({ classId, subjectId, teacherId, dayOfWeek, startTime, endTime }) {
  const { error } = await supabase.from("timetable").insert({
    class_id: classId,
    subject_id: subjectId,
    teacher_id: teacherId || null,
    day_of_week: dayOfWeek,
    start_time: startTime,
    end_time: endTime,
  });
  if (error) throw error;
}

export async function deleteTimetableEntry(id) {
  const { error } = await supabase.from("timetable").delete().eq("id", id);
  if (error) throw error;
}
