export interface CustomResourceItem {
  id: string;
  parentId: string; // folder ID or 'root'
  title: string;
  kind: 'folder' | 'file';
  content?: string;
  url?: string;
  icon?: string;
  createdAt: string;
  updatedAt: string;
}

const STORAGE_KEY = 'prepamigo_custom_resources_v1';

export function getCustomItems(): CustomResourceItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveCustomItems(items: CustomResourceItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch (err) {
    console.error('Failed to save custom resources:', err);
  }
}

export function addCustomItem(item: {
  parentId: string;
  title: string;
  kind: 'folder' | 'file';
  content?: string;
  url?: string;
  icon?: string;
}): CustomResourceItem {
  const items = getCustomItems();
  const newItem: CustomResourceItem = {
    id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    parentId: item.parentId || 'root',
    title: item.title.trim() || (item.kind === 'folder' ? 'Untitled Folder' : 'Untitled Note'),
    kind: item.kind,
    content: item.content || '',
    url: item.url || '',
    icon: item.icon || (item.kind === 'folder' ? 'folder' : 'document-text'),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  items.push(newItem);
  saveCustomItems(items);
  return newItem;
}

export function updateCustomItem(
  id: string,
  updates: Partial<Pick<CustomResourceItem, 'title' | 'content' | 'url' | 'icon'>>
): CustomResourceItem | null {
  const items = getCustomItems();
  const idx = items.findIndex((i) => i.id === id);
  if (idx === -1) return null;
  items[idx] = {
    ...items[idx],
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  saveCustomItems(items);
  return items[idx];
}

export function deleteCustomItem(id: string): void {
  const items = getCustomItems();
  // Find all descendants to delete
  const toDelete = new Set<string>([id]);
  let added = true;
  while (added) {
    added = false;
    for (const item of items) {
      if (!toDelete.has(item.id) && toDelete.has(item.parentId)) {
        toDelete.add(item.id);
        added = true;
      }
    }
  }
  const remaining = items.filter((i) => !toDelete.has(i.id));
  saveCustomItems(remaining);
}
