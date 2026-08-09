import { GoTrueAuth } from "./auth/gotrue.ts";
import { GitHubGatewayAPI } from "./git/github.ts";
import { OperationsProvider } from "./operations.ts";
import type { GatewayConfig, CommitAuthor } from "./utils/types.ts";
import { AuthUser } from "./auth/_types.ts";
import { AuthProvider } from "./auth/_provider.ts";
import { GitProvider } from "./git/_provider.ts";

export class DecapGateway {
	private _auth: AuthProvider;
	private _git!: GitProvider;
	private _operations!: OperationsProvider;
	private config: GatewayConfig;
	private user: AuthUser | null = null;

	constructor(config: GatewayConfig) {
		this.config = config;
		this._auth = new GoTrueAuth(config.identityUrl);
	}

	async login(
		email: string,
		password: string,
		persist: boolean,
	): Promise<AuthUser> {
		this.user = await this._auth.login(email, password, persist);
		await this.initGateway();
		return this.user;
	}

	async restore(): Promise<AuthUser | null> {
		this.user = await this._auth.restore();
		if (!this.user) return null;
		await this.initGateway();
		return this.user;
	}

	private async initGateway(): Promise<void> {
		const author = this.getAuthor();
		this._git = new GitHubGatewayAPI(
			this.config.gatewayUrl,
			() => this._auth.getToken(),
			this.config.repo,
			this.config.branch || "main",
			author,
		);
		this._operations = new OperationsProvider(this._git);
	}

	private getAuthor(): CommitAuthor {
		const meta = this.user?.userMetadata || {};
		return {
			name:
				(meta.full_name as string) ||
				this.user?.email?.split("@")[0] ||
				"unknown",
			email: this.user?.email || "",
		};
	}

	get operations(): OperationsProvider {
		if (!this._operations)
			throw new Error("Not authenticated. Call login() or restore() first.");
		return this._operations;
	}

	get git(): GitProvider {
		if (!this._git)
			throw new Error("Not authenticated. Call login() or restore() first.");
		return this._git;
	}

	async logout(): Promise<void> {
		await this._auth.logout();
		this.user = null;
	}

	async getToken(): Promise<string> {
		return this._auth.getToken();
	}
}
