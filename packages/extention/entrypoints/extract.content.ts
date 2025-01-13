import { defineContentScript } from "wxt/sandbox";

export default defineContentScript({
	matches: [],
	registration: "runtime",
	main(ctx) {
		console.log("Script was executed!");

		const content = cleanHTML();
		console.log(content);
		return content;
	},
});

const cleanHTML = (): string => {
	const content: HTMLElement = document.documentElement.cloneNode(
		true,
	) as HTMLElement;

	const removeElements: string[] = [
		"script",
		"style",
		"link",
		"meta",
		"noscript",
		"iframe",
		"svg",
		"img",
		"video",
		"audio",
	];

	const requiresChildren: string[] = [
		"span",
		"div",
		"p",
		"section",
		"article",
		"main",
		"header",
		"footer",
		"nav",
		"aside",
		"ul",
		"ol",
		"table",
		"tr",
		"thead",
		"tbody",
		"tfoot",
	];

	removeUnwantedElements(content, removeElements);
	removeComments(content);
	cleanAttributes(content);
	removeEmptyElements(content, requiresChildren);

	const cleanedHTML = content.innerHTML
		.replace(/^\s*[\r\n]/gm, "")
		.replace(/\s+/g, " ")
		.trim();

	return cleanedHTML;
};

const removeUnwantedElements = (
	content: HTMLElement,
	selectors: readonly string[],
): void => {
	for (const selector of selectors) {
		const elements = content.querySelectorAll(selector);
		for (const el of elements) {
			el.remove();
		}
	}
};

const removeComments = (element: Node): void => {
	const walker: TreeWalker = document.createTreeWalker(
		element,
		NodeFilter.SHOW_COMMENT,
		null,
	);
	const comments: Comment[] = [];
	while (walker.nextNode()) {
		const comment = walker.currentNode as Comment;
		comments.push(comment);
	}
	for (const comment of comments) {
		comment.remove();
	}
};

const cleanAttributes = (element: Element): void => {
	if (element.attributes) {
		for (const attr of element.attributes) {
			if (attr.name !== "class") {
				element.removeAttribute(attr.name);
			}
		}
	}

	if (element.children) {
		for (const child of element.children) {
			cleanAttributes(child as Element);
		}
	}
};

const removeEmptyElements = (
	element: Element,
	requiresChildren: string[],
): void => {
	for (const child of element.children) {
		removeEmptyElements(child, requiresChildren);
	}

	// 子が無いと意味の無い要素を削除
	if (
		requiresChildren.includes(element.tagName.toLowerCase()) &&
		!element.children.length &&
		!element.textContent?.trim()
	) {
		element.remove();
	}
};
