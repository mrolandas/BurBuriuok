import type { DndEvent } from 'svelte-dnd-action';

type DndInternalIndexDetail = {
	indexObj: {
		index: number;
	};
	draggedEl: HTMLElement;
};

type DndInternalLeftDetail = {
	draggedEl: HTMLElement;
	type: 'leftForAnother' | 'outsideOfAny';
	theOtherDz?: HTMLElement;
};

declare global {
	namespace svelteHTML {
		interface HTMLAttributes<T> {
			'on:consider'?: (
				event: CustomEvent<DndEvent<unknown>> & { currentTarget: EventTarget & T }
			) => void;
			'on:finalize'?: (
				event: CustomEvent<DndEvent<unknown>> & { currentTarget: EventTarget & T }
			) => void;
			'on:draggedEntered'?: (
				event: CustomEvent<DndInternalIndexDetail> & { currentTarget: EventTarget & T }
			) => void;
			'on:draggedOverIndex'?: (
				event: CustomEvent<DndInternalIndexDetail> & { currentTarget: EventTarget & T }
			) => void;
			'on:draggedLeft'?: (
				event: CustomEvent<DndInternalLeftDetail> & { currentTarget: EventTarget & T }
			) => void;
		}
	}
}

export {};
