import { GatewaySettings } from "../types";

export class GatewayClient {
	private baseUrl: string;
	private tokenFn: () => Promise<string>;

	constructor(gatewayUrl: string, tokenFn: () => Promise<string>) {
		this.baseUrl = gatewayUrl.replace(/\/$/, "");
		this.tokenFn = tokenFn;
	}

	async request<T = any>(path: string, options: RequestInit = {}): Promise<T> {
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
		return res.text() as unknown as T;
	}

	async getSettings(): Promise<GatewaySettings> {
		const token = await this.tokenFn();
		const res = await fetch(`${this.baseUrl}/settings`, {
			headers: { Authorization: `Bearer ${token}` },
		});
		if (!res.ok)
			throw new GatewayError(res.status, "Failed to fetch gateway settings");
		return res.json() as Promise<GatewaySettings>;
	}
}

export class GatewayError extends Error {
	constructor(
		public status: number,
		message: string,
	) {
		super(message);
		this.name = "GatewayError";
	}
}
