export interface GatewayConfig {
	identityUrl: string;
	gatewayUrl: string;
	repo: string;
	branch?: string;
	commitMessages?: CommitMessages;
}

export interface CommitMessages {
	create?: string;
	update?: string;
	delete?: string;
	uploadMedia?: string;
	deleteMedia?: string;
	openAuthoring?: string;
}

export interface CommitAuthor {
	name: string;
	email: string;
}

export interface FileEntry {
	path: string;
	content: string | ArrayBuffer;
	sha?: string;
}

export interface MediaFile {
	path: string;
	content: Blob | string;
	encoding?: "base64" | "utf-8";
}

export interface PersistOptions {
	commitMessage: string;
	author: CommitAuthor;
	branch?: string;
}

export interface TreeEntry {
	path: string;
	mode: "100644";
	type: "blob";
	sha: string | null;
}

export interface GitRef {
	ref: string;
	sha: string;
}

export interface GatewaySettings {
	github_enabled: boolean;
	roles?: string[];
}
