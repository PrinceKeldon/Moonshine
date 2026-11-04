import { n as TSS_SERVER_FUNCTION, r as getServerFnById, t as createServerFn } from "./ssr.mjs";
// node_modules/.nitro/vite/services/ssr/assets/wallet-QdX2ufqE.js
var createSsrRpc = (functionId) => {
	const url = "/_serverFn/" + functionId;
	const serverFnMeta = { id: functionId };
	const fn = async (...args) => {
		return (await getServerFnById(functionId, { origin: "server" }))(...args);
	};
	return Object.assign(fn, {
		url,
		serverFnMeta,
		[TSS_SERVER_FUNCTION]: true
	});
};
var B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function isSolanaAddress(value) {
	if (value.length < 32 || value.length > 44) return false;
	let zeros = 0;
	while (value[zeros] === "1") zeros += 1;
	const bytes = [];
	for (let i = zeros; i < value.length; i += 1) {
		const digit = B58.indexOf(value[i] ?? "");
		if (digit < 0) return false;
		let carry = digit;
		for (let j = 0; j < bytes.length; j += 1) {
			carry += bytes[j] * 58;
			bytes[j] = carry & 255;
			carry >>= 8;
		}
		while (carry > 0) {
			bytes.push(carry & 255);
			carry >>= 8;
		}
	}
	return zeros + bytes.length === 32;
}
var fetchWallet = createServerFn({ method: "POST" }).validator((input) => {
	const address = input.address.trim();
	if (!isSolanaAddress(address)) throw new Error("That is not a Solana address.");
	return { address };
}).handler(createSsrRpc("90871f9f5928875fa77ba1a07a866f9f1217d8be682fbc70e006900d6459d2d2"));
export { fetchWallet as n, isSolanaAddress as r, createSsrRpc as t };
