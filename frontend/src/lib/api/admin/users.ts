import { adminFetch } from '$lib/api/admin/client';
import type { ProfileRole } from '../../../../../shared/validation/profileSchema';

export type AdminProfileSummary = {
	id: string;
	email: string;
	role: ProfileRole;
	preferredLanguage: string;
	callsign: string | null;
	createdAt: string;
	updatedAt: string;
};

export type AdminInviteSummary = {
	id: string;
	email: string;
	role: ProfileRole;
	status: 'pending' | 'accepted' | 'revoked' | 'expired';
	expiresAt: string;
	invitedBy: string | null;
	acceptedProfileId: string | null;
	acceptedAt: string | null;
	revokedAt: string | null;
	createdAt: string;
	updatedAt: string;
};

export type AdminUsersResponse = {
	admins: AdminProfileSummary[];
	invites: AdminInviteSummary[];
	meta: {
		fetchedAt: string;
		adminCount: number;
		pendingInviteCount: number;
	};
};

export type CreateInviteInput = {
	email: string;
	role: ProfileRole;
	expiresInHours?: number;
};

export type CreateInviteResponse = {
	invite: AdminInviteSummary;
	inviteToken: string;
	redirectTarget: string;
};

export async function fetchAdminUsers(): Promise<AdminUsersResponse> {
	const response = await adminFetch<{ data: { admins: AdminProfileSummary[]; invites: AdminInviteSummary[] }; meta: AdminUsersResponse['meta'] }>('/users');
	return {
		admins: response.data.admins,
		invites: response.data.invites,
		meta: response.meta
	};
}

export async function createAdminInvite(payload: CreateInviteInput): Promise<CreateInviteResponse> {
	const response = await adminFetch<{ data: CreateInviteResponse }>('/users/invite', {
		method: 'POST',
		body: JSON.stringify(payload)
	});
	return response.data;
}

export async function revokeAdminInvite(inviteId: string): Promise<AdminInviteSummary> {
	const response = await adminFetch<{ data: { invite: AdminInviteSummary } }>(`/users/invite/${inviteId}`, {
		method: 'DELETE'
	});
	return response.data.invite;
}

export async function updateAdminUserRole(
	profileId: string,
	role: ProfileRole
): Promise<AdminProfileSummary> {
	const response = await adminFetch<{ data: { profile: AdminProfileSummary } }>(`/users/${profileId}/role`, {
		method: 'PATCH',
		body: JSON.stringify({ role })
	});
	return response.data.profile;
}
