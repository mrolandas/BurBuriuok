type AdminSessionStatus = 'granted' | 'denied';

type AdminSessionEvent = {
	status: AdminSessionStatus;
	reason: string;
	email: string | null;
	appRole: string | null;
	timestamp?: string;
};

export function logAdminSessionEvent(event: AdminSessionEvent): void {
	const detail = {
		...event,
		timestamp: event.timestamp ?? new Date().toISOString(),
		source: 'backend'
	};

	// eslint-disable-next-line no-console
	console.info('[telemetry] admin_session_checked', detail);
}

type AgentToolEvent = {
	tool: string;
	success: boolean;
	durationMs: number;
	error?: string;
	itemCount?: number;
	timestamp?: string;
};

export function logAgentToolEvent(event: AgentToolEvent): void {
	const detail = {
		...event,
		timestamp: event.timestamp ?? new Date().toISOString(),
		source: 'backend'
	};

	// eslint-disable-next-line no-console
	console.info('[telemetry] agent_tool_executed', detail);
}

type AgentSessionEvent = {
	model: string;
	toolCallCount: number;
	iterationCount: number;
	durationMs: number;
	success: boolean;
	error?: string;
	timestamp?: string;
};

export function logAgentSessionEvent(event: AgentSessionEvent): void {
	const detail = {
		...event,
		timestamp: event.timestamp ?? new Date().toISOString(),
		source: 'backend'
	};

	// eslint-disable-next-line no-console
	console.info('[telemetry] agent_session_completed', detail);
}
