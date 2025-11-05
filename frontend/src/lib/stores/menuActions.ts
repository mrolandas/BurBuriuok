import { writable } from 'svelte/store';

export type MenuAction = {
	id: string;
	label: string;
	onSelect: () => void;
	disabled?: boolean;
};

const { subscribe, update } = writable<MenuAction[]>([]);

export const menuActionsStore = { subscribe };

export function registerMenuAction(action: MenuAction): () => void {
	update((current) => {
		const filtered = current.filter((item) => item.id !== action.id);
		return [...filtered, action];
	});

	return () => unregisterMenuAction(action.id);
}

export function unregisterMenuAction(id: string) {
	update((current) => current.filter((item) => item.id !== id));
}
