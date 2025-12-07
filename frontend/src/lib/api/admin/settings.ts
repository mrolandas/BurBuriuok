import { adminFetch } from '$lib/api/admin/client';

export type RegistrationSettingResponse = {
	enabled: boolean;
};

export async function getRegistrationSetting(): Promise<RegistrationSettingResponse> {
	const response = await adminFetch<{ data: RegistrationSettingResponse }>('settings/registration');
	return response.data;
}

export async function updateRegistrationSetting(enabled: boolean): Promise<void> {
	await adminFetch('settings/registration', {
		method: 'PATCH',
		body: JSON.stringify({ value: enabled })
	});
}
