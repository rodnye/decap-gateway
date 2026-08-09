export class AuthError extends Error {
	constructor(
		public status: number,
		message: string,
	) {
		super(message);
		this.name = "AuthError";
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
