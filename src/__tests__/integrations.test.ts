import { DecapGateway } from "../../build/index.js";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";

//
// 1. Environment & configuration
//
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const requiredEnvVars = [
	"IDENTITY_URL",
	"GATEWAY_URL",
	"REPO",
	"EMAIL",
	"PASSWORD",
] as const;

for (const key of requiredEnvVars) {
	if (!process.env[key]) {
		console.error(`Missing environment variable: ${key}`);
		process.exit(1);
	}
}

const config = {
	identityUrl: process.env.IDENTITY_URL!,
	gatewayUrl: process.env.GATEWAY_URL!,
	repo: process.env.REPO!,
	branch: process.env.BRANCH || "decap-cms-tests/data",
	email: process.env.EMAIL!,
	password: process.env.PASSWORD!,
};

const TEST_ROOT = "test-data";
const TEST_FOLDER = `${TEST_ROOT}/${Date.now()}`; // unique per run
const LOCAL_IMAGE_PATH = path.join(__dirname, "test-image.png");

//
// 2. Test utilities
//
async function readFileAsBuffer(filePath: string): Promise<ArrayBuffer> {
	const buffer = await fs.readFile(filePath);
	return buffer.buffer.slice(
		buffer.byteOffset,
		buffer.byteOffset + buffer.byteLength,
	);
}

// -----------------------------------------------------------------------------
// 3. Test suite
// -----------------------------------------------------------------------------
describe("DecapGateway Integration Tests", () => {
	let gateway: DecapGateway;

	// ---------------------------------------------------------------------------
	// Setup & Teardown
	// ---------------------------------------------------------------------------
	before(async () => {
		// Create fresh gateway and authenticate
		gateway = new DecapGateway({
			identityUrl: config.identityUrl,
			gatewayUrl: config.gatewayUrl,
			repo: config.repo,
			branch: config.branch,
		});

		const user = await gateway.login(config.email, config.password, true);
		assert.ok(user, "Authentication should succeed");
		assert.strictEqual(
			user.email,
			config.email,
			"Logged-in email should match",
		);
	});

	// ---------------------------------------------------------------------------
	// Tests
	// ---------------------------------------------------------------------------
	it("should read an existing file (src/data/categories.json)", async () => {
		const content = await gateway.operations.readFile(
			"src/data/categories.json",
		);
		const json = JSON.parse(content);
		assert.ok(Array.isArray(json.categories), "Should have categories array");
	});

	it("should write and read back a single text file", async () => {
		const filePath = `${TEST_FOLDER}/test.txt`;
		const content = `Hello from test at ${new Date().toISOString()}`;

		await gateway.operations.writeFiles([{ path: filePath, content }], {
			branch: config.branch,
			commitMessage: "test: write single file",
			author: { name: "Test", email: "test@example.com" },
		});

		const readContent = await gateway.operations.readFile(filePath);
		assert.strictEqual(
			readContent,
			content,
			"Written content should match read content",
		);
	});

	it("should write multiple files and list them", async () => {
		const files = [
			{ path: `${TEST_FOLDER}/multi/a.txt`, content: "A" },
			{ path: `${TEST_FOLDER}/multi/b.txt`, content: "B" },
			{ path: `${TEST_FOLDER}/multi/c.txt`, content: "C" },
		];

		await gateway.operations.writeFiles(files, {
			branch: config.branch,
			commitMessage: "test: write multiple files",
			author: { name: "Test", email: "test@example.com" },
		});

		const listed = await gateway.operations.listFiles(`${TEST_FOLDER}/multi`);
		assert.strictEqual(listed.length, files.length, "Should list all files");

		for (const file of files) {
			const read = await gateway.operations.readFile(file.path);
			assert.strictEqual(
				read,
				file.content,
				`Content of ${file.path} should match`,
			);
		}
	});

	it("should upload and download an image preserving binary integrity", async () => {
		// Skip if local test image does not exist
		try {
			await fs.access(LOCAL_IMAGE_PATH);
		} catch {
			console.warn(`⚠️ Skipping image test: ${LOCAL_IMAGE_PATH} not found`);
			return;
		}

		const imageBuffer = await readFileAsBuffer(LOCAL_IMAGE_PATH);
		const imagePath = `${TEST_FOLDER}/image.png`;

		// Upload as binary (ArrayBuffer)
		await gateway.operations.writeFiles(
			[{ path: imagePath, content: imageBuffer }],
			{
				branch: config.branch,
				commitMessage: "test: upload image",
				author: { name: "Test", email: "test@example.com" },
			},
		);

		// Retrieve SHA and blob
		const sha = await gateway.git.getFileSha(imagePath);
		assert.ok(sha, "Image SHA should exist");

		const blob = await gateway.git.getBlob(sha!);
		assert.strictEqual(
			blob.encoding,
			"base64",
			"Blob should be base64-encoded",
		);

		const downloadedBuffer = Buffer.from(blob.content, "base64");
		const localBuffer = await fs.readFile(LOCAL_IMAGE_PATH);

		assert.deepStrictEqual(
			downloadedBuffer,
			localBuffer,
			"Downloaded image should match original",
		);
	});

	it("should return SHA for existing files and null for missing ones", async () => {
		const existing = await gateway.git.getFileSha("src/data/categories.json");
		assert.ok(existing, "Existing file SHA should be truthy");

		const missing = await gateway.git.getFileSha("non/existent/file.txt");
		assert.strictEqual(missing, null, "Missing file SHA should be null");
	});

	it("should delete files and empty the test folder", async () => {
		// Ensure we have something to delete (if previous tests passed)
		const filesToDelete = await gateway.operations.listFiles(TEST_FOLDER);
		const paths = filesToDelete.map((f) => f.path);

		if (paths.length > 0) {
			await gateway.operations.deleteFiles(paths, {
				branch: config.branch,
				commitMessage: "test: delete test files",
				author: { name: "Test", email: "test@example.com" },
			});

			const remaining = await gateway.operations.listFiles(TEST_FOLDER);
			assert.strictEqual(
				remaining.length,
				0,
				"Folder should be empty after delete",
			);
		} else {
			assert.ok(true, "No files to delete");
		}
	});

	it("should report write access", async () => {
		const hasWrite = await gateway.git.hasWriteAccess();
		assert.strictEqual(hasWrite, true, "Token should have write access");
	});

	it("should throw a meaningful error when reading a non-existent file", async () => {
		await assert.rejects(
			() => gateway.operations.readFile("this-file-does-not-exist.txt"),
			/File not found/,
			"Should reject with appropriate error",
		);
	});

	// ---------------------------------------------------------------------------
	// Cleanup (runs after all tests)
	// ---------------------------------------------------------------------------
	after(async () => {
		// Final cleanup to remove any leftover test data
		try {
			const remaining = await gateway.operations.listFiles(TEST_FOLDER);
			const paths = remaining.map((f) => f.path);
			if (paths.length > 0) {
				await gateway.operations.deleteFiles(paths, {
					branch: config.branch,
					commitMessage: "test: final cleanup",
					author: { name: "Test", email: "test@example.com" },
				});
				console.log(`🧹 Cleaned up ${paths.length} files`);
			}
		} catch (err) {
			console.warn("⚠️ Final cleanup failed:", (err as Error).message);
		}

		// Logout
		try {
			await gateway.logout();
			console.log("👋 Logged out");
		} catch (err) {
			console.warn("⚠️ Logout failed:", (err as Error).message);
		}
	});
});
