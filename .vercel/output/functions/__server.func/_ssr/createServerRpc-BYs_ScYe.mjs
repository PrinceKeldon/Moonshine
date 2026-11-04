import { n as TSS_SERVER_FUNCTION } from "./ssr.mjs";
// node_modules/.nitro/vite/services/ssr/assets/createServerRpc-BYs_ScYe.js
var createServerRpc = (serverFnMeta, splitImportFn) => {
	const url = "/_serverFn/" + serverFnMeta.id;
	return Object.assign(splitImportFn, {
		url,
		serverFnMeta,
		[TSS_SERVER_FUNCTION]: true
	});
};
export { createServerRpc as t };
