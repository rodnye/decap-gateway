import type { FileEntry, PersistOptions, TreeEntry } from "./utils/types.ts";
import { bufferToBase64, utf8ToBase64 } from "./utils/base64.ts";
import { GatewayError } from "./utils/errors.ts";
import { GitProvider } from "./git/_provider.ts";

const MAX_RETRIES = 3;

export class OperationsProvider {
	constructor(private git: GitProvider) {}

	async readFile(path: string, branch?: string): Promise<string> {
		return this.git.getFileContent(path, branch);
	}

	async readFileSha(path: string, branch?: string): Promise<string | null> {
		return this.git.getFileSha(path, branch);
	}

	async listFiles(
		folder: string,
		branch?: string,
	): Promise<{ path: string; sha: string }[]> {
		const tree: any = await this.git.listTree(branch, folder);
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

		const treeEntries: TreeEntry[] = [];

		for (const file of files) {
			const content =
				typeof file.content === "string"
					? utf8ToBase64(file.content)
					: bufferToBase64(file.content);
			const blob = await this.git.createBlob(content, "base64");
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

		for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
			const head = await this.git.getBranch(branch);
			const baseSha: string = head.commit.sha;
			const baseTreeSha: string = head.commit.commit.tree.sha;

			const tree = await this.git.createTree(baseTreeSha, treeEntries);
			const commit = await this.git.createCommit(
				options.commitMessage,
				tree.sha,
				[baseSha],
				options.author,
			);

			try {
				await this.git.patchRef(
					`heads/${encodeURIComponent(branch!)}`,
					commit.sha,
				);
				return; // success
			} catch (err: unknown) {
				const isConflict = err instanceof GatewayError && err.status === 422;
				if (!isConflict || attempt === MAX_RETRIES - 1) {
					throw err;
				}
				// 422 "not a fast forward"
			}
		}
	}

	async writeFiles(files: FileEntry[], options: PersistOptions): Promise<void> {
		return this.persistFiles(files, [], options);
	}

	async deleteFiles(paths: string[], options: PersistOptions): Promise<void> {
		return this.persistFiles([], paths, options);
	}
}
