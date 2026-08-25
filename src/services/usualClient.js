import { apiRequest } from "./apiClient";
import { getCurrentUserId } from "./authClient";

async function requireUser() {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error("Missing user ID");
  return userId;
}

export async function listUsuals() {
  await requireUser();
  const { payload, error } = await apiRequest("/usuals");
  if (error) throw new Error(error.message);
  return payload?.data || [];
}

export async function saveUsual(input) {
  await requireUser();
  const { payload, error } = await apiRequest("/usuals", {
    method: "POST",
    csrf: true,
    body: input,
  });
  if (error) throw new Error(error.message);
  return payload?.data;
}

export async function updateUsual(usualId, patch) {
  await requireUser();
  const { payload, error } = await apiRequest(`/usuals/${encodeURIComponent(usualId)}`, {
    method: "PUT",
    csrf: true,
    body: patch,
  });
  if (error) throw new Error(error.message);
  return payload?.data;
}

export async function deleteUsual(usualId) {
  await requireUser();
  const { error } = await apiRequest(`/usuals/${encodeURIComponent(usualId)}`, {
    method: "DELETE",
    csrf: true,
  });
  if (error) throw new Error(error.message);
}

