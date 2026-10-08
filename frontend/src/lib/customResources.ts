import { apiFetch } from "./api/client";

export interface CustomResourceItem {
  id: string;
  parentId: string;
  title: string;
  kind: "folder" | "file";
  content: string;
  url: string;
  icon: string;
  legacyId?: string;
  createdAt: string;
  updatedAt: string;
}

type ResourceResponse = { success: boolean; data: CustomResourceItem[] };
type SingleResourceResponse = { success: boolean; data: CustomResourceItem };

export function getCustomItems(): Promise<CustomResourceItem[]> {
  return apiFetch<ResourceResponse>("/api/resources").then((response) => response.data);
}

export function addCustomItem(item: {
  parentId: string;
  title: string;
  kind: "folder" | "file";
  content?: string;
  url?: string;
  icon?: string;
  legacyId?: string;
}): Promise<CustomResourceItem> {
  return apiFetch<SingleResourceResponse>("/api/resources", {
    method: "POST",
    body: JSON.stringify(item),
  }).then((response) => response.data);
}

export function getLegacyCustomItems(): CustomResourceItem[] {
  try {
    const raw = localStorage.getItem("prepamigo_custom_resources_v1");
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is CustomResourceItem =>
      typeof item?.id === "string" &&
      typeof item?.title === "string" &&
      (item?.kind === "folder" || item?.kind === "file"),
    );
  } catch (error) {
    console.error("[Resources] Could not read older browser resources:", error);
    return [];
  }
}

export function clearLegacyCustomItems(): void {
  localStorage.removeItem("prepamigo_custom_resources_v1");
}

export function updateCustomItem(
  id: string,
  updates: Partial<Pick<CustomResourceItem, "title" | "content" | "url" | "icon">>,
): Promise<CustomResourceItem> {
  return apiFetch<SingleResourceResponse>(`/api/resources/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  }).then((response) => response.data);
}

export function deleteCustomItem(id: string): Promise<void> {
  return apiFetch<{ success: boolean }>(`/api/resources/${encodeURIComponent(id)}`, {
    method: "DELETE",
  }).then(() => undefined);
}
