import type { GatewayClient } from "./client.ts";
import type { TreeEntry, PullRequest, CommitAuthor } from "../types.ts";

export class GitHubGatewayAPI {
	private client: GatewayClient;
	private repo: string;
	private branch: string;
	private commitAuthor: CommitAuthor;

	constructor(
		client: GatewayClient,
		repo: string,
		branch: string,
		commitAuthor: CommitAuthor,
	) {
		this.client = client;
		this.repo = repo;
		this.branch = branch;
		this.commitAuthor = commitAuthor;
	}

	private repoPath(path = ""): string {
		return `/repos/${this.repo}${path}`;
	}

	async getBranch(branch = this.branch) {
		return this.client.request(
			this.repoPath(`/branches/${encodeURIComponent(branch)}`),
		);
	}

	async getRef(ref: string) {
		return this.client.request(this.repoPath(`/git/ref/${ref}`));
	}

	async createRef(ref: string, sha: string) {
		return this.client.request(this.repoPath("/git/refs"), {
			method: "POST",
			body: JSON.stringify({ ref: `refs/${ref}`, sha }),
		});
	}

	async patchRef(ref: string, sha: string, force = false) {
		return this.client.request(this.repoPath(`/git/refs/${ref}`), {
			method: "PATCH",
			body: JSON.stringify({ sha, force }),
		});
	}

	async deleteRef(ref: string) {
		return this.client.request(this.repoPath(`/git/refs/${ref}`), {
			method: "DELETE",
		});
	}

	async getBlob(sha: string): Promise<{ content: string; encoding: string }> {
		return this.client.request(this.repoPath(`/git/blobs/${sha}`));
	}

	async createBlob(content: string, encoding: "base64" | "utf-8" = "base64") {
		return this.client.request(this.repoPath("/git/blobs"), {
			method: "POST",
			body: JSON.stringify({ content, encoding }),
		});
	}

	async getTree(sha: string, recursive = false) {
		const q = recursive ? "?recursive=1" : "";
		return this.client.request(this.repoPath(`/git/trees/${sha}${q}`));
	}

	async createTree(baseSha: string | null, tree: TreeEntry[]) {
		return this.client.request(this.repoPath("/git/trees"), {
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
		return this.client.request(this.repoPath("/git/commits"), {
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
		const encoded = encodeURIComponent(path);
		const res: any = await this.client.request(
			this.repoPath(`/contents/${encoded}?ref=${encodeURIComponent(branch)}`),
		);
		if (res.encoding === "base64") {
			return atob(res.content.replace(/\n/g, ""));
		}
		return res.content;
	}

	async getFileSha(path: string, branch = this.branch): Promise<string | null> {
		try {
			const parts = path.split("/");
			const filename = parts.pop()!;
			const dir = parts.join("/");
			const treeRef = `${branch}:${dir}`;
			const tree: any = await this.client.request(
				this.repoPath(`/git/trees/${encodeURIComponent(treeRef)}`),
			);
			const file = tree.tree?.find((f: any) => f.path === filename);
			return file?.sha || null;
		} catch {
			return null;
		}
	}

	async listTree(branch = this.branch, path = "", recursive = false) {
		const ref = path ? `${branch}:${path}` : branch;
		return this.getTree(encodeURIComponent(ref), recursive);
	}

	async createPullRequest(
		title: string,
		head: string,
		base = this.branch,
	): Promise<PullRequest> {
		return this.client.request(this.repoPath("/pulls"), {
			method: "POST",
			body: JSON.stringify({ title, head, base }),
		});
	}

	async getPullRequests(state = "open", head?: string) {
		const params = new URLSearchParams({ state, per_page: "100" });
		if (head) params.set("head", head);
		return this.client.request(this.repoPath(`/pulls?${params}`));
	}

	async mergePullRequest(number: number, sha: string, method = "merge") {
		return this.client.request(this.repoPath(`/pulls/${number}/merge`), {
			method: "PUT",
			body: JSON.stringify({ sha, merge_method: method }),
		});
	}

	async closePullRequest(number: number) {
		return this.client.request(this.repoPath(`/pulls/${number}`), {
			method: "PATCH",
			body: JSON.stringify({ state: "closed" }),
		});
	}

	async getCompare(base: string, head: string) {
		return this.client.request(this.repoPath(`/compare/${base}...${head}`));
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
