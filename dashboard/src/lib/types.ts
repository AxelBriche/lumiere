export interface LumiereConfig {
	enabled: boolean;
	minObservations: number;
	model: string;
	intervalMinutes: number;
}

export interface LumiereStatus {
	running: boolean;
	pid: number | null;
	pendingObservations: number;
	totalIntuitions: number;
	enabled: boolean;
	intervalMinutes: number;
	lastAnalysis: string | null;
}

export interface Intuition {
	id: string;
	trigger: string;
	confidence: number;
	domain: string;
	source: string;
	filename: string;
	content: string;
	createdAt: string;
}
