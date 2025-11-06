import type { Request } from 'express';

declare module 'express-serve-static-core' {
	interface Request {
		authUser?: {
			id: string;
			email?: string | null;
			appRole?: string | null;
		};
	}
}

// Ensure the file is treated as a module.
export type AugmentedRequest = Request;
