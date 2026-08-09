# decap-gateway

Client that replicates the [Decap CMS](https://decapcms.org/) internal flow against [DecapBridge](https://decapbridge.com/)-compatible gateways.

Created to allow custom implementations without depending on the full Decap CMS bundle.

Manages authentication, tree operations, blob manipulation, commits, and media persistence against a GitHub repository through a proxied API.

> [!IMPORTANT]
> Current only support Github Provider.

## Install

```bash
npm install github:rodnye/decap-gateway#latest

# coming soon...
# npm install @rodny/decap-gateway
```

## Quick start

```ts
import { DecapGateway } from "@rodny/decap-gateway";

const decap = new DecapGateway({
  identityUrl: "https://auth.decapbridge.com/sites/xxxxxx-xxxxxx-xxxxxx-xxxxxx",
  gatewayUrl: "https://decap.decapbridge.com",

  repo: "owner/repo",
  branch: "main",
});

const user = await decap.login("user@example.com", "xxxxxxxxx");
const content = await decap.operations.readFile("src/data/config.json");
```

## Configuration

```ts
interface GatewayConfig {
  identityUrl: string; // Netlify Identity endpoint (recommended DecapBridge)
  gatewayUrl: string; // Git gateway URL
  repo: string; // GitHub repo (owner/name)
  branch?: string; // Default branch (default: "main")
  commitMessages?: CommitMessages;
}
```

## OperationsProvider

High-level interface for reading, listing, writing, and deleting files.

### readFile

```ts
const raw = await decap.operations.readFile("src/data/products/item.json");
const data = JSON.parse(raw);
```

### readFileSha

```ts
const sha = await decap.operations.readFileSha("src/data/products/item.json");
// "cc651297356949ec49a9cc7af4583de8ee74700b" or null
```

### listFiles

```ts
const files = await decap.operations.listFiles("src/data/products");
// [{ path: "src/data/products/item.json", sha: "cc6512..." }, ...]
```

### writeFiles

Create or update files and commit

```ts
await decap.operations.writeFiles(
  [
    {
      path: "src/data/products/item.json",
      content: JSON.stringify(data, null, 2),
    },
    { path: "src/data/products/other.json", content: '{"key":"value"}' },
  ],
  {
    commitMessage: 'data: update "item" - user via DecapBridge',
    author: { name: "User", email: "user@example.com" },
  },
);
```

### deleteFiles

```ts
await decap.operations.deleteFiles(["src/data/products/obsolete.json"], {
  commitMessage: 'data: delete "obsolete" - user via @rodny/decap-gateway',
  author: { name: "User", email: "user@example.com" },
});
```

### persistFiles

Create, remove or update files and commit in a single operation.

```ts
await decap.operations.persistFiles(
  [
    {
      path: "src/data/products/item.json",
      content: JSON.stringify(data, null, 2),
    },
    { path: "src/data/products/other.json", content: '{"key":"value"}' },
  ],
  ["src/data/products/obsolete.json"],
  {
    commitMessage: 'data: update "item" - user via DecapBridge',
    author: { name: "User", email: "user@example.com" },
  },
);
```

## DecapGateway

Main entry point. Handles auth lifecycle and exposes operation layers.

```ts
const decap = new DecapGateway(config);
```

### Methods

| Method                   | Returns            | Description                         |
| ------------------------ | ------------------ | ----------------------------------- |
| `login(email, password)` | `AuthUser`         | Authenticate and initialize gateway |
| `restore()`              | `AuthUser \| null` | Restore session from storage        |
| `logout()`               | `void`             | Clear session                       |
| `getToken()`             | `string`           | Get current JWT                     |

### Properties

| Property     | Type                 | Description                |
| ------------ | -------------------- | -------------------------- |
| `operations` | `OperationsProvider` | High-level file operations |
| `git`        | `GitProvider`        | Low-level git plumbing     |

## GitProvider

Low-level git plumbing. Maps directly to gateway endpoints.

### Branches and refs

```ts
// GET /github/branches/{branch}
const branch = await decap.git.getBranch();
// { commit: { sha: "..." }, protected: false }

// GET /github/git/refs/{ref}
const ref = await decap.git.getRef("heads/main");

// POST /github/git/refs
await decap.git.createRef("heads/new-branch", parentSha);

// PATCH /github/git/refs/{ref}
await decap.git.patchRef("heads/main", commitSha);

// DELETE /github/git/refs/{ref}
await decap.git.deleteRef("heads/old-branch");
```

### Trees

```ts
// List root tree: GET /github/git/trees/{branch}:
const root = await decap.git.listTree();
// { sha: "...", tree: [{ path, type, sha, size }, ...] }

// List subdirectory: GET /github/git/trees/{branch}:{encoded_path}
const tree = await decap.git.listTree("main", "src/data/products");

// List recursively
const full = await decap.git.listTree("main", "", true);
```

### Blobs

```ts
// GET /github/git/blobs/{sha}
const blob = await decap.git.getBlob("cc65129735...");
// { content: "base64...", encoding: "base64" }

// POST /github/git/blobs
const newBlob = await decap.git.createBlob(base64Content, "base64");
// { sha: "..." }
```

### Commits

```ts
// POST /github/git/trees
const tree = await decap.git.createTree(baseTreeSha, [
  { path: "file.json", mode: "100644", type: "blob", sha: blobSha },
]);

// POST /github/git/commits
const commit = await decap.git.createCommit(
  "data: update file",
  tree.sha,
  [parentSha],
  { name: "Author", email: "author@example.com" },
);
```

### Commit history

```ts
// GET /github/commits?path={file}&sha={branch}
const history = await decap.git.getCommits("src/data/categories.json");
```

### File content (composite)

Reads a file by resolving tree entry then fetching blob.

```ts
const content = await decap.git.getFileContent("src/data/config.json");
```

### File SHA lookup

```ts
const sha = await decap.git.getFileSha("src/data/config.json");
```

### Write access check

```ts
const canWrite = await decap.git.hasWriteAccess();
```

## Examples

## Example 1: Edit a product in a repo

```ts
import { DecapGateway } from "@rodny/decap-gateway";

const decap = new DecapGateway({
  identityUrl: "https://auth.decapbridge.com/sites/xxxxxx-xxxxxx-xxxxxx-xxxxxx",
  gatewayUrl: "https://decap.decapbridge.com",
  repo: "pepe/catalog",
  branch: "dev",
});

await decap.login("admin@example.com", "secret");

// List products
const files = await decap.operations.listFiles("src/data/products");
console.log(files.map((f) => f.path));

// Read and modify
const raw = await decap.operations.readFile("src/data/products/chorizo.json");
const product = JSON.parse(raw);
product.price = 200;
product.available = false;

// Commit
await decap.operations.writeFiles(
  [
    {
      path: "src/data/products/chorizo.json",
      content: JSON.stringify(product, null, 2),
    },
  ],
  {
    commitMessage: 'data: update "chorizo" - admin via @rodny/decap-gateway',
    author: { name: "Admin", email: "admin@example.com" },
  },
);

await decap.logout();
```

### Example 2: Upload a image in browser

```ts
import { DecapGateway } from "@rodny/decap-gateway";

const decap = new DecapGateway({
  identityUrl: "https://auth.decapbridge.com/sites/xxxxxx-xxxxxx-xxxxxx-xxxxxx",
  gatewayUrl: "https://decap.decapbridge.com",
  repo: "owner/repo",
  branch: "main",
});

await decap.login("user@example.com", "password");

const input = document.querySelector<HTMLInputElement>("#file-input");

input.addEventListener("change", async () => {
  const file = input.files[0];
  if (!file) return;

  // Convert File to base64
  const buffer = await file.arrayBuffer();
  const base64 = btoa(
    new Uint8Array(buffer).reduce(
      (data, byte) => data + String.fromCharCode(byte),
      "",
    ),
  );

  const destPath = `public/images/${file.name}`;

  await decap.operations.persistFiles(
    [{ path: destPath, content: base64 }],
    [],
    {
      commitMessage: `data: upload "${destPath}" - ${decap.user.email} via @rodny/decap-gateway`,
      author: { name: decap.user.email.split("@")[0], email: gw.user.email },
      branch: "main",
    },
  );

  console.log(`Uploaded: ${destPath}`);
});
```

### Example 3: Upload a image in Node.js

```ts
import { DecapGateway } from "@rodny/decap-gateway";
import { readFileSync } from "fs";

const gw = new DecapGateway({
  identityUrl: "https://your-site.netlify.app/.netlify/identity",
  gatewayUrl: "https://decap.decapbridge.com",
  repo: "owner/repo",
  branch: "main",
});

await decap.login("user@example.com", "password");

const filePath = "./photo.png";
const base64 = readFileSync(filePath).toString("base64");
const destPath = "public/images/photo.png";

await decap.operations.persistFiles([{ path: destPath, content: base64 }], [], {
  commitMessage: `data: upload "${destPath}" - admin via @rodny/decap-gateway`,
  author: { name: "Admin", email: "user@example.com" },
  branch: "main",
});

console.log(`Uploaded: ${destPath}`);
await decap.logout();
```

### Example 4: Downloading images

```ts
// Browser
const tree = await decap.github.listTree("main", "public/images");
const png = tree.tree.find((f) => f.path.endsWith(".png"));
const blob = await decap.github.getBlob(png.sha);
const bytes = Uint8Array.from(atob(blob.content), (c) => c.charCodeAt(0));
const url = URL.createObjectURL(new Blob([bytes], { type: "image/png" }));

// Node.js
import { writeFileSync } from "fs";
const buffer = Buffer.from(blob.content, "base64");
writeFileSync(png.path.split("/").pop(), buffer);
```

### Example 5: Deleting files

```ts
await decap.operations.deleteFiles(["public/images/old-photo.png"], {
  commitMessage:
    'data: delete "public/images/old-photo.png" - admin via DecapBridge',
  author: { name: "Admin", email: "user@example.com" },
});
```

## Endpoint mapping

| Library method              | HTTP   | Gateway path                        |
| --------------------------- | ------ | ----------------------------------- |
| `getBranch(b)`              | GET    | `/github/branches/{b}`              |
| `getRef(r)`                 | GET    | `/github/git/refs/{r}`              |
| `createRef(r, sha)`         | POST   | `/github/git/refs`                  |
| `patchRef(r, sha)`          | PATCH  | `/github/git/refs/{r}`              |
| `deleteRef(r)`              | DELETE | `/github/git/refs/{r}`              |
| `getTree(ref)`              | GET    | `/github/git/trees/{ref}`           |
| `createTree(base, entries)` | POST   | `/github/git/trees`                 |
| `getBlob(sha)`              | GET    | `/github/git/blobs/{sha}`           |
| `createBlob(content)`       | POST   | `/github/git/blobs`                 |
| `createCommit(...)`         | POST   | `/github/git/commits`               |
| `getCommits(path, sha)`     | GET    | `/github/commits?path=&sha=`        |
| `listTree(branch, path)`    | GET    | `/github/git/trees/{branch}:{path}` |

Tree ref format: `{branch}:{encodeURIComponent(path)}`. Use `{branch}:` for root.

## License

MIT
