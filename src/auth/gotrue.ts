import type { AuthUser } from "../types.ts";
import { GoTrueAuthError } from "./errors.ts";

interface GoTrueTokenResponse {
	access_token: string;
	token_type: string;
	expires_in: number;
	refresh_token: string;
	id: string;
	email: string;
	user_metadata?: Record<string, unknown>;
}

/**
 * Implementation of GoTrue api with browser local storage
 */
export class GoTrueAuth {
	private apiUrl: string;
	private currentUser: AuthUser | null = null;

	constructor(identityUrl: string) {
		this.apiUrl = identityUrl.replace(/\/$/, "");
	}

	/**
	 * login into gateway
	 */
	async login(
		email: string,
		password: string,
		persist: boolean = false,
	): Promise<AuthUser> {
		const res = await fetch(`${this.apiUrl}/token?grant_type=password`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ username: email, password }),
		});

		if (!res.ok) {
			const body = await res.text().catch(() => "");
			throw new GoTrueAuthError(res.status, body || "Authentication failed");
		}

		const data = (await res.json()) as GoTrueTokenResponse;
		this.currentUser = this.mapResponse(data);

		if (persist) this.persist(this.currentUser);

		return this.currentUser;
	}

	/**
	 * Restore latest session (only browser)
	 */
	async restore(): Promise<AuthUser | null> {
		const stored = this.readPersisted();
		if (!stored) return null;

		if (stored.expiresAt > Date.now() + 30_000) {
			this.currentUser = stored;
			return stored;
		}

		try {
			const refreshed = await this.refreshToken(stored.refreshToken);
			this.currentUser = refreshed;
			this.persist(refreshed);
			return refreshed;
		} catch {
			this.clearPersisted();
			return null;
		}
	}

	/**
	 *
	 */
	async getToken(): Promise<string> {
		if (!this.currentUser) throw new GoTrueAuthError(401, "Not authenticated");

		if (this.currentUser.expiresAt < Date.now() + 30_000) {
			const refreshed = await this.refreshToken(this.currentUser.refreshToken);
			this.currentUser = refreshed;
			this.persist(refreshed);
		}

		return this.currentUser.token;
	}

	async logout(): Promise<void> {
		if (this.currentUser) {
			try {
				await fetch(`${this.apiUrl}/logout`, {
					method: "POST",
					headers: { Authorization: `Bearer ${this.currentUser.token}` },
				});
			} catch {
				//
			}
		}
		this.currentUser = null;
		this.clearPersisted();
	}

	//
	// Private methods ...
	//

	private async refreshToken(refreshToken: string): Promise<AuthUser> {
		const res = await fetch(`${this.apiUrl}/token?grant_type=refresh_token`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ refresh_token: refreshToken }),
		});

		if (!res.ok) {
			throw new GoTrueAuthError(res.status, "Token refresh failed");
		}

		const data = (await res.json()) as GoTrueTokenResponse;
		return this.mapResponse(data);
	}

	private mapResponse(data: GoTrueTokenResponse): AuthUser {
		return {
			id: data.id,
			email: data.email,
			token: data.access_token,
			refreshToken: data.refresh_token,
			userMetadata: data.user_metadata ?? {},
			expiresAt: Date.now() + data.expires_in * 1000,
		};
	}

	//
	// Browser Localstorage methods...
	//

	private STORAGE_KEY = "decap_gateway_session";

	private persist(user: AuthUser): void {
		if (typeof globalThis.localStorage !== "undefined") {
			try {
				globalThis.localStorage.setItem(this.STORAGE_KEY, JSON.stringify(user));
			} catch {
				// quota exceeded, ignore
			}
		}
	}

	private readPersisted(): AuthUser | null {
		if (typeof globalThis.localStorage === "undefined") return null;
		try {
			const raw = globalThis.localStorage.getItem(this.STORAGE_KEY);
			return raw ? (JSON.parse(raw) as AuthUser) : null;
		} catch {
			return null;
		}
	}

	private clearPersisted(): void {
		if (typeof globalThis.localStorage !== "undefined") {
			globalThis.localStorage.removeItem(this.STORAGE_KEY);
		}
	}
}
