export class GoTrueAuthError extends Error {
	constructor(
		public status: number,
		message: string,
	) {
		super(message);
		this.name = "GoTrueAuthError";
	}
}
