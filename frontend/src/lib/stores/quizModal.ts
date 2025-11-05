import { writable } from 'svelte/store';

export type QuizModalContext = {
	conceptId?: string;
	sectionCode?: string;
};

export type QuizModalState = {
	open: boolean;
	context: QuizModalContext | null;
};

const initialState: QuizModalState = { open: false, context: null };

const store = writable<QuizModalState>(initialState);

export const quizModal = {
	subscribe: store.subscribe,
	open: (context?: QuizModalContext) => {
		store.set({ open: true, context: context ?? null });
	},
	close: () => {
		store.set(initialState);
	}
};
