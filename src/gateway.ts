import { GoTrueAuth } from "./auth/gotrue.ts";
import { GatewayClient } from "./gateway/client.ts";
import { GitHubGatewayAPI } from "./gateway/github.ts";
import { GitOperations } from "./git/operations.ts";
import type { GatewayConfig, AuthUser, CommitAuthor } from "./types.ts";

export class DecapGateway {
	private auth: GoTrueAuth;
	private client!: GatewayClient;
	private api!: GitHubGatewayAPI;
	private git!: GitOperations;
	private config: GatewayConfig;
	private user: AuthUser | null = null;

	constructor(config: GatewayConfig) {
		this.config = config;
		this.auth = new GoTrueAuth(config.identityUrl);
	}

	async login(email: string, password: string): Promise<AuthUser> {
		this.user = await this.auth.login(email, password);
		await this.initGateway();
		return this.user;
	}

	async restore(): Promise<AuthUser | null> {
		this.user = await this.auth.restore();
		if (!this.user) return null;
		await this.initGateway();
		return this.user;
	}

	private async initGateway(): Promise<void> {
		this.client = new GatewayClient(this.config.gatewayUrl, () =>
			this.auth.getToken(),
		);

		const settings = await this.client.getSettings();
		if (!settings.github_enabled) {
			throw new Error("GitHub is not enabled on this gateway");
		}

		const author = this.resolveAuthor();
		this.api = new GitHubGatewayAPI(
			this.client,
			this.config.repo,
			this.config.branch || "main",
			author,
		);
		this.git = new GitOperations(this.api);
	}

	private resolveAuthor(): CommitAuthor {
		const meta = this.user?.userMetadata || {};
		return {
			name:
				(meta.full_name as string) ||
				this.user?.email?.split("@")[0] ||
				"unknown",
			email: this.user?.email || "",
		};
	}

	get operations(): GitOperations {
		if (!this.git)
			throw new Error("Not authenticated. Call login() or restore() first.");
		return this.git;
	}

	get github(): GitHubGatewayAPI {
		if (!this.api)
			throw new Error("Not authenticated. Call login() or restore() first.");
		return this.api;
	}

	async logout(): Promise<void> {
		await this.auth.logout();
		this.user = null;
	}

	async getToken(): Promise<string> {
		return this.auth.getToken();
	}
}
