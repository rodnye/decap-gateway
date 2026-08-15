import type { components } from "@octokit/openapi-types";
import type { CommitAuthor, TreeEntry } from "../utils/types";

/**
 * Generic interface for a gateway that interacts with version control systems
 * (GitHub, GitLab, Bitbucket, etc.)
 */
export interface GitProvider {
	defaults: {
		baseUrl: string;
		commitAuthor: CommitAuthor;
		branch: string;
	};

	/**
	 * Low-level method to make HTTP requests.
	 * @param path Relative path to the specific gateway endpoint (e.g., "/git/refs").
	 * @param options Fetch options (method, body, headers, etc.).
	 * @returns Parsed response (JSON, text, or undefined).
	 */
	request<T = any>(path: string, options?: RequestInit): Promise<T>;

	/**
	 *
	 */
	checkAvailable(): Promise<boolean>;

	/**
	 * Retrieves information about a branch.
	 * @param branch Branch name (defaults to the one used during construction).
	 */
	getBranch(
		branch?: string,
	): Promise<components["schemas"]["branch-with-protection"]>;

	/**
	 * Retrieves a reference (tag, branch) by its name.
	 * @param ref Reference name (e.g., "heads/main").
	 */
	getRef(ref: string): Promise<any>;

	/**
	 * Creates a new reference.
	 * @param ref Full name (e.g., "heads/feature").
	 * @param sha SHA of the commit it points to.
	 */
	createRef(ref: string, sha: string): Promise<any>;

	/**
	 * Updates an existing reference.
	 * @param ref Reference name.
	 * @param sha New SHA.
	 * @param force Whether to allow a forced update.
	 */
	patchRef(ref: string, sha: string, force?: boolean): Promise<any>;

	/**
	 * Deletes a reference.
	 * @param ref Reference name.
	 */
	deleteRef(ref: string): Promise<any>;

	/**
	 * Retrieves the content of a blob by its SHA.
	 * @param sha Blob hash.
	 * @returns Object containing content and encoding.
	 */
	getBlob(sha: string): Promise<components["schemas"]["blob"]>;

	/**
	 * Creates a new blob.
	 * @param content Content (encoded).
	 * @param encoding "base64" or "utf-8".
	 */
	createBlob(
		content: string,
		encoding?: "base64" | "utf-8",
	): Promise<components["schemas"]["short-blob"]>;

	/**
	 * Retrieves a tree by its reference (SHA or branch:path).
	 * @param treeRef Tree reference.
	 * @param recursive Whether to include subdirectories recursively.
	 */
	getTree(treeRef: string, recursive?: boolean): Promise<any>;

	/**
	 * Creates a new tree.
	 * @param baseSha SHA of the base tree (optional).
	 * @param tree List of tree entries.
	 */
	createTree(baseSha: string | null, tree: TreeEntry[]): Promise<any>;

	/**
	 * Creates a commit.
	 * @param message Commit message.
	 * @param treeSha Tree SHA.
	 * @param parents List of parent commit SHAs.
	 * @param author Commit author (optional, uses the default configured one).
	 */
	createCommit(
		message: string,
		treeSha: string,
		parents: string[],
		author?: CommitAuthor,
	): Promise<components["schemas"]["commit"]>;

	/**
	 * Retrieves a file's content as text.
	 * @param path Full path within the repository.
	 * @param branch Branch to look in (optional).
	 * @returns Decoded UTF-8 content.
	 */
	getFileContent(path: string, branch?: string): Promise<string>;

	/**
	 * Retrieves the SHA of a file, or null if it does not exist.
	 * @param path Full path.
	 * @param branch Branch to look in.
	 */
	getFileSha(path: string, branch?: string): Promise<string | null>;

	/**
	 * Lists the contents of a directory (tree).
	 * @param branch Branch.
	 * @param path Directory path (empty for root).
	 * @param recursive Whether to list recursively.
	 */
	listTree(branch?: string, path?: string, recursive?: boolean): Promise<any>;

	/**
	 * Retrieves the commit history for a file or directory.
	 * @param path Path.
	 * @param branch Branch.
	 */
	getCommits(path: string, branch?: string): Promise<any>;

	/**
	 * Checks whether the current token has write permissions.
	 */
	hasWriteAccess(): Promise<boolean>;
}
