export function utf8ToBase64(str: string) {
	const bytes = new TextEncoder().encode(str);
	let binary = "";
	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}
	return btoa(binary);
}

export function base64ToUtf8(b64: string) {
	const binary = atob(b64);
	const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
	return new TextDecoder().decode(bytes);
}

export function bufferToBase64(buffer: ArrayBuffer) {
	return btoa(
		new Uint8Array(buffer).reduce(
			(data, byte) => data + String.fromCharCode(byte),
			"",
		),
	);
}
