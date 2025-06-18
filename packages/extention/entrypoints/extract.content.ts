import { defineContentScript } from "wxt/utils/define-content-script";
import {
	generateAriaTree,
	renderAriaTree,
} from "./playwright/ariaSnapshot/ariaSnapshot";

export default defineContentScript({
	matches: [],
	registration: "runtime",
	main(_ctx) {
		console.log("Script was executed!");

		const ariaTree = generateAriaTree(document.documentElement);
		console.log(ariaTree);

		const rendered = renderAriaTree(ariaTree.root);
		console.warn(rendered);

		return rendered;
	},
});
