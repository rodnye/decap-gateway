import type {
	TreeEntry,
	CommitAuthor,
	GatewaySettings,
} from "../utils/types.ts";
import { base64ToUtf8 } from "../utils/base64.ts";
import { GatewayError } from "../utils/errors.ts";
import { GitProvider } from "./_provider.ts";

/**
 * INFO: This gateway not use standars Github Endpoints, use a custom implementation write by Decap
 */
export class GitHubGatewayAPI implements GitProvider {
	private baseUrl: string;
	private branch: string;
	private commitAuthor: CommitAuthor;
	private tokenFn: () => Promise<string>;
	private githubAvailable: boolean = false;

	constructor(
		gatewayUrl: string,
		token: string | (() => Promise<string>),
		_repo: string,
		branch: string,
		commitAuthor: CommitAuthor,
	) {
		this.baseUrl = gatewayUrl.replace(/\/$/, "");
		this.tokenFn = typeof token === "string" ? async () => token : token;
		this.branch = branch;
		this.commitAuthor = commitAuthor;
	}

	/**
	 * Low method to make requests
	 */
	async request<T = any>(path: string, options: RequestInit = {}): Promise<T> {
		await this.checkAvailable();

		const token = await this.tokenFn();
		const url = `${this.baseUrl}/github${path}`;

		const headers: Record<string, string> = {
			Authorization: `Bearer ${token}`,
			...(options.headers as Record<string, string>),
		};

		if (options.body && !headers["Content-Type"]) {
			headers["Content-Type"] = "application/json; charset=utf-8";
		}

		const res = await fetch(url, {
			...options,
			headers,
		});

		if (!res.ok) {
			const body = await res.text().catch(() => "");
			throw new GatewayError(res.status, body || res.statusText);
		}

		if (res.status === 204) return undefined as T;

		const ct = res.headers.get("Content-Type") || "";
		if (ct.includes("json")) return res.json() as T;
		return res.text() as T;
	}

	/**
	 * Throw error if not Github Provider available
	 */
	async checkAvailable() {
		if (!this.githubAvailable) {
			const token = await this.tokenFn();
			const res = await fetch(`${this.baseUrl}/settings`, {
				headers: { Authorization: `Bearer ${token}` },
			});
			if (!res.ok)
				throw new GatewayError(res.status, "Failed to fetch gateway settings");
			const settings = (await res.json()) as GatewaySettings;

			if (!settings.github_enabled) {
				throw new Error("GitHub is not enabled on this gateway");
			}
		}
		return (this.githubAvailable = true);
	}

	async getBranch(branch = this.branch) {
		return this.request(`/branches/${encodeURIComponent(branch)}`);
	}

	async getRef(ref: string) {
		return this.request(`/git/refs/${ref}`);
	}

	async createRef(ref: string, sha: string) {
		return this.request("/git/refs", {
			method: "POST",
			body: JSON.stringify({ ref: `refs/${ref}`, sha }),
		});
	}

	async patchRef(ref: string, sha: string, force = false) {
		return this.request(`/git/refs/${ref}`, {
			method: "PATCH",
			body: JSON.stringify({ sha, force }),
		});
	}

	async deleteRef(ref: string) {
		return this.request(`/git/refs/${ref}`, {
			method: "DELETE",
		});
	}

	async getBlob(sha: string): Promise<{ content: string; encoding: string }> {
		return this.request(`/git/blobs/${sha}`);
	}

	async createBlob(content: string, encoding: "base64" | "utf-8" = "base64") {
		return this.request("/git/blobs", {
			method: "POST",
			body: JSON.stringify({ content, encoding }),
		});
	}

	async getTree(treeRef: string, recursive = false) {
		const q = recursive ? "?recursive=1" : "";
		return this.request(`/git/trees/${treeRef}${q}`);
	}

	async createTree(baseSha: string | null, tree: TreeEntry[]) {
		return this.request("/git/trees", {
			method: "POST",
			body: JSON.stringify({
				...(baseSha ? { base_tree: baseSha } : {}),
				tree,
			}),
		});
	}

	async createCommit(
		message: string,
		treeSha: string,
		parents: string[],
		author?: CommitAuthor,
	) {
		return this.request("/git/commits", {
			method: "POST",
			body: JSON.stringify({
				message,
				tree: treeSha,
				parents,
				author: {
					...(author || this.commitAuthor),
					date: new Date().toISOString(),
				},
			}),
		});
	}

	async getFileContent(path: string, branch = this.branch): Promise<string> {
		const parts = path.split("/");
		const filename = parts.pop()!;
		const dir = parts.join("/");
		const treeRef = dir ? `${branch}:${encodeURIComponent(dir)}` : `${branch}:`;
		const tree: any = await this.getTree(treeRef);
		const entry = (tree.tree || []).find(
			(f: any) => f.path === filename && f.type === "blob",
		);
		if (!entry) throw new Error(`File not found: ${path}`);
		const blob = await this.getBlob(entry.sha);
		if (blob.encoding === "base64") {
			return base64ToUtf8(blob.content.replace(/\n/g, ""));
		}
		return blob.content;
	}

	async getFileSha(path: string, branch = this.branch): Promise<string | null> {
		try {
			const parts = path.split("/");
			const filename = parts.pop()!;
			const dir = parts.join("/");
			const treeRef = dir
				? `${branch}:${encodeURIComponent(dir)}`
				: `${branch}:`;
			const tree: any = await this.getTree(treeRef);
			const file = (tree.tree || []).find((f: any) => f.path === filename);
			return file?.sha || null;
		} catch {
			return null;
		}
	}

	async listTree(branch = this.branch, path = "", recursive = false) {
		const treeRef = path
			? `${branch}:${encodeURIComponent(path)}`
			: `${branch}:`;
		return this.getTree(treeRef, recursive);
	}

	async getCommits(path: string, branch = this.branch) {
		const params = new URLSearchParams({
			path,
			sha: branch,
		});
		return this.request(`/commits?${params.toString()}`);
	}

	async hasWriteAccess(): Promise<boolean> {
		try {
			await this.getBranch();
			return true;
		} catch {
			return false;
		}
	}
}
