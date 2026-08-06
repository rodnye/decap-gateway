import GoTrue from "gotrue-js";
import type { AuthUser } from "../types.ts";

export class GoTrueAuth {
	private client: GoTrue;
	private currentUser: AuthUser | null = null;

	constructor(identityUrl: string) {
		this.client = new GoTrue({ APIUrl: identityUrl });
	}

	async login(email: string, password: string): Promise<AuthUser> {
		const user = await this.client.login(email, password, true);
		this.currentUser = this.mapUser(user);
		return this.currentUser;
	}

	async restore(): Promise<AuthUser | null> {
		const user = this.client.currentUser();
		if (!user) return null;
		this.currentUser = this.mapUser(user);
		return this.currentUser;
	}

	async getToken(): Promise<string> {
		if (!this.currentUser) throw new Error("Not authenticated");
		const user = this.client.currentUser();
		if (!user) throw new Error("Session expired");
		return user.token?.access_token || (user["access_token"] as string);
	}

	async logout(): Promise<void> {
		const user = this.client.currentUser();
		if (user) await user.logout();
		this.currentUser = null;
	}

	private mapUser(user: any): AuthUser {
		return {
			id: user.id,
			email: user.email,
			token: user.token.access_token,
			refreshToken: user.token.refresh_token,
			userMetadata: user.user_metadata || {},
			expiresAt: user.token.expires_at,
		};
	}
}
