import { supabase } from "./supabaseClient";

// Limits mirror the bucket settings in supabase/storage_setup.sql.
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;
export const AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
export const DOCUMENT_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
];
export const DOCUMENT_ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.txt";

// Storage object keys only allow a limited character set (no [ ] { } # % ^ ~ |
// quotes, non-ASCII, ...). Anything else is turned into "-". Repeated
// underscores are collapsed because "__" separates category from file name.
export function safeFileName(name) {
  const cleaned = String(name || "file")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9._ -]/g, "-")
    .replace(/_{2,}/g, "_")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned && cleaned !== "." && cleaned !== ".." ? cleaned.slice(-120) : "file";
}

function formatMB(bytes) {
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}

function checkFile(file, { maxBytes, types, label }) {
  if (!file) throw new Error("No file selected.");
  if (file.size === 0) throw new Error("That file is empty.");
  if (file.size > maxBytes) throw new Error(`${label} must be ${formatMB(maxBytes)} or smaller.`);
  if (file.type && !types.includes(file.type)) {
    throw new Error(`That file type isn't allowed. Allowed: ${types.map((t) => t.split("/").pop()).join(", ")}.`);
  }
}

// Turns raw storage errors into something an end user can act on.
function friendly(error, bucket) {
  const msg = (error && error.message) || "Storage request failed.";
  if (/bucket not found/i.test(msg)) {
    return new Error(
      `The "${bucket}" storage bucket doesn't exist yet. Ask the administrator to run supabase/storage_setup.sql.`
    );
  }
  if (/row-level security|not authorized|unauthorized|violates/i.test(msg)) {
    return new Error("You don't have permission to do that. If this keeps happening, the storage policies may be missing.");
  }
  if (/mime type|not supported|invalid.*type/i.test(msg)) return new Error("That file type isn't allowed.");
  if (/exceeded|too large|maximum allowed size|payload/i.test(msg)) return new Error("That file is too large.");
  return new Error(msg);
}

export async function uploadAvatar(userId, file) {
  checkFile(file, { maxBytes: AVATAR_MAX_BYTES, types: AVATAR_TYPES, label: "Profile photo" });

  const ext = (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
  const path = `${userId}/avatar.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, file, { upsert: true, contentType: file.type || undefined });
  if (uploadError) throw friendly(uploadError, "avatars");

  // A previous avatar with a different extension would otherwise linger.
  try {
    const { data: existing } = await supabase.storage.from("avatars").list(userId);
    const stale = (existing || []).filter((f) => f.name !== `avatar.${ext}`).map((f) => `${userId}/${f.name}`);
    if (stale.length) await supabase.storage.from("avatars").remove(stale);
  } catch (err) {
    // Cleanup is best-effort only.
  }

  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  const publicUrl = `${data.publicUrl}?t=${Date.now()}`;

  const { error: updateError } = await supabase.from("profiles").update({ avatar_url: publicUrl }).eq("id", userId);
  if (updateError) throw updateError;

  return publicUrl;
}

export async function uploadDocument(userId, file, category) {
  checkFile(file, { maxBytes: DOCUMENT_MAX_BYTES, types: DOCUMENT_TYPES, label: "Documents" });

  const prefix = category ? `${safeFileName(category).replace(/_/g, "-")}__` : "";
  const path = `${userId}/${prefix}${Date.now()}-${safeFileName(file.name)}`;
  const { error } = await supabase.storage
    .from("documents")
    .upload(path, file, { contentType: file.type || undefined });
  if (error) throw friendly(error, "documents");
  return path;
}

export async function listMyDocuments(userId) {
  const { data, error } = await supabase.storage
    .from("documents")
    .list(userId, { sortBy: { column: "created_at", order: "desc" } });
  if (error) throw friendly(error, "documents");
  return (data || [])
    .filter((f) => f.name !== ".emptyFolderPlaceholder")
    .map((f) => {
      const match = f.name.match(/^([^_]+)__(.+)$/);
      return {
        ...f,
        path: `${userId}/${f.name}`,
        category: match ? match[1] : "Other",
        // strip the leading upload timestamp for display
        displayName: (match ? match[2] : f.name).replace(/^\d{10,}-/, ""),
      };
    });
}

export async function getDocumentUrl(path) {
  const { data, error } = await supabase.storage.from("documents").createSignedUrl(path, 60 * 5);
  if (error) throw friendly(error, "documents");
  return data.signedUrl;
}

export async function deleteDocument(path) {
  const { data, error } = await supabase.storage.from("documents").remove([path]);
  if (error) throw friendly(error, "documents");
  // Storage answers "success" with an empty list when a policy hides the file,
  // so an empty result means nothing was actually deleted.
  if (!data || data.length === 0) {
    throw new Error("The document could not be deleted (it may already be gone, or you don't have permission).");
  }
}
