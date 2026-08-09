import type { AuthUser } from "./_types.ts";

/**
 * Abstract base class for authentication services.
 * Provides a common interface for login, logout, session restoration,
 * token management, and session persistence.
 */
export abstract class AuthProvider {
	/**
	 * The base URL of the authentication API.
	 */
	protected apiUrl: string;

	/**
	 * The currently authenticated user, or null if not authenticated.
	 */
	protected currentUser: AuthUser | null = null;

	/**
	 * Initializes the authentication provider with the API endpoint.
	 * @param identityUrl - The root URL of the authentication service (e.g., https://auth.decapbridge.com/sites/xxxx-xxxx-xxxx-xxxx)
	 */
	constructor(identityUrl: string) {
		this.apiUrl = identityUrl.replace(/\/$/, "");
	}

	/**
	 * Authenticates a user using email and password.
	 * @param email - The user's email address.
	 * @param password - The user's password.
	 * @param persist - If true, the session will be persisted (e.g., in localStorage).
	 * @returns A promise resolving to the authenticated user object.
	 * @throws {AuthError} If authentication fails.
	 */
	abstract login(
		email: string,
		password: string,
		persist?: boolean,
	): Promise<AuthUser>;

	/**
	 * Logs out the current user.
	 * This should invalidate the session locally and optionally notify the server.
	 * @throws {AuthError} If the user is not authenticated or refresh fails.
	 */
	abstract logout(): Promise<void>;

	/**
	 * Attempts to restore a previously persisted session.
	 * If the session is still valid, it is restored; otherwise, it may be refreshed
	 * or discarded.
	 */
	abstract restore(): Promise<AuthUser | null>;

	/**
	 * Retrieves the current access token.
	 * If the token is about to expire, it will be automatically refreshed.
	 * @returns A promise resolving to the current valid access token.
	 * @throws {AuthError} If the user is not authenticated or refresh fails.
	 */
	abstract getToken(): Promise<string>;
}
