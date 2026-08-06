export { GoTrueAuth } from "./auth/gotrue.ts";
export { GatewayClient, GatewayError } from "./gateway/client.ts";
export { GitHubGatewayAPI } from "./gateway/github.ts";
export { GitOperations } from "./git/operations.ts";
export { DecapGateway } from "./gateway.ts";
export type {
	GatewayConfig,
	CommitMessages,
	AuthUser,
	CommitAuthor,
	FileEntry,
	MediaFile,
	PersistOptions,
	TreeEntry,
	GitRef,
	PullRequest,
	GatewaySettings,
} from "./types.ts";
