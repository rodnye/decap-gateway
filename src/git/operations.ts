import type { GitHubGatewayAPI } from "../gateway/github.ts";
import type { FileEntry, PersistOptions, TreeEntry } from "../types.ts";

export class GitOperations {
	constructor(private api: GitHubGatewayAPI) {}

	async readFile(path: string, branch?: string): Promise<string> {
		return this.api.getFileContent(path, branch);
	}

	async readFileSha(path: string, branch?: string): Promise<string | null> {
		return this.api.getFileSha(path, branch);
	}

	async listFiles(
		folder: string,
		branch?: string,
	): Promise<{ path: string; sha: string }[]> {
		const tree: any = await this.api.listTree(branch, folder);
		return (tree.tree || [])
			.filter((f: any) => f.type === "blob")
			.map((f: any) => ({
				path: folder ? `${folder}/${f.path}` : f.path,
				sha: f.sha,
			}));
	}

	async persistFiles(
		files: FileEntry[],
		deletePaths: string[],
		options: PersistOptions,
	): Promise<void> {
		const branch = options.branch;
		const head = await this.api.getBranch(branch);
		const baseSha = head.commit.sha;

		const treeEntries: TreeEntry[] = [];

		for (const file of files) {
			const content =
				typeof file.content === "string"
					? btoa(encodeURIComponent(file.content))
					: "";
			const blob = await this.api.createBlob(content, "base64");
			treeEntries.push({
				path: file.path,
				mode: "100644",
				type: "blob",
				sha: blob.sha,
			});
		}

		for (const del of deletePaths) {
			treeEntries.push({ path: del, mode: "100644", type: "blob", sha: null });
		}

		const tree = await this.api.createTree(baseSha, treeEntries);
		const commit = await this.api.createCommit(
			options.commitMessage,
			tree.sha,
			[baseSha],
			options.author,
		);

		await this.api.patchRef(`heads/${encodeURIComponent(branch!)}`, commit.sha);
	}

	async deleteFiles(paths: string[], options: PersistOptions): Promise<void> {
		return this.persistFiles([], paths, options);
	}

	async createBranch(branchName: string, fromBranch?: string): Promise<void> {
		const source = await this.api.getBranch(fromBranch);
		await this.api.createRef(`heads/${branchName}`, source.commit.sha);
	}

	async deleteBranch(branchName: string): Promise<void> {
		try {
			await this.api.deleteRef(`heads/${encodeURIComponent(branchName)}`);
		} catch {
			// already deleted
		}
	}
}
