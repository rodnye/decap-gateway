export interface AuthUser {
	id: string;
	email: string;
	token: string;
	refreshToken: string;
	userMetadata: Record<string, unknown>;
	expiresAt: number;
}

export interface GoTrueTokenResponse {
	access_token: string;
	token_type: string;
	expires_in: number;
	refresh_token: string;
	id: string;
	email: string;
	user_metadata?: Record<string, unknown>;
}
