import type { GatewayClient } from "./client.ts";
import type { TreeEntry, PullRequest, CommitAuthor } from "../types.ts";

export class GitHubGatewayAPI {
	private client: GatewayClient;
	private branch: string;
	private commitAuthor: CommitAuthor;

	constructor(
		client: GatewayClient,
		_repo: string,
		branch: string,
		commitAuthor: CommitAuthor,
	) {
		this.client = client;
		this.branch = branch;
		this.commitAuthor = commitAuthor;
	}

	async getBranch(branch = this.branch) {
		return this.client.request(`/branches/${encodeURIComponent(branch)}`);
	}

	async getRef(ref: string) {
		return this.client.request(`/git/refs/${ref}`);
	}

	async createRef(ref: string, sha: string) {
		return this.client.request("/git/refs", {
			method: "POST",
			body: JSON.stringify({ ref: `refs/${ref}`, sha }),
		});
	}

	async patchRef(ref: string, sha: string, force = false) {
		return this.client.request(`/git/refs/${ref}`, {
			method: "PATCH",
			body: JSON.stringify({ sha, force }),
		});
	}

	async deleteRef(ref: string) {
		return this.client.request(`/git/refs/${ref}`, {
			method: "DELETE",
		});
	}

	async getBlob(sha: string): Promise<{ content: string; encoding: string }> {
		return this.client.request(`/git/blobs/${sha}`);
	}

	async createBlob(content: string, encoding: "base64" | "utf-8" = "base64") {
		return this.client.request("/git/blobs", {
			method: "POST",
			body: JSON.stringify({ content, encoding }),
		});
	}

	async getTree(treeRef: string, recursive = false) {
		const q = recursive ? "?recursive=1" : "";
		return this.client.request(`/git/trees/${treeRef}${q}`);
	}

	async createTree(baseSha: string | null, tree: TreeEntry[]) {
		return this.client.request("/git/trees", {
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
		return this.client.request("/git/commits", {
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
			return atob(blob.content.replace(/\n/g, ""));
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
		return this.client.request(`/commits?${params.toString()}`);
	}

	async createPullRequest(
		title: string,
		head: string,
		base = this.branch,
	): Promise<PullRequest> {
		return this.client.request("/pulls", {
			method: "POST",
			body: JSON.stringify({ title, head, base }),
		});
	}

	async getPullRequests(state = "open", head?: string) {
		const params = new URLSearchParams({ state, per_page: "100" });
		if (head) params.set("head", head);
		return this.client.request(`/pulls?${params.toString()}`);
	}

	async mergePullRequest(number: number, sha: string, method = "merge") {
		return this.client.request(`/pulls/${number}/merge`, {
			method: "PUT",
			body: JSON.stringify({ sha, merge_method: method }),
		});
	}

	async closePullRequest(number: number) {
		return this.client.request(`/pulls/${number}`, {
			method: "PATCH",
			body: JSON.stringify({ state: "closed" }),
		});
	}

	async getCompare(base: string, head: string) {
		return this.client.request(`/compare/${base}...${head}`);
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
