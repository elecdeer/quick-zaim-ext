import { defineContentScript } from "wxt/sandbox";

export default defineContentScript({
	matches: [],
	registration: "runtime",
	main(ctx) {
		console.log("Script was executed!");

		const content = cleanHTML();
		console.log(content);

		const trans = transcript(document.documentElement, [
			"html",
			"head",
			"body",
			"div",
			"p",
			"a",
			"br",
			"hr",
			"span",
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
			"td",
			"th",
			"caption",
			"thead",
			"tbody",
			"tfoot",
			"h1",
			"h2",
			"h3",
			"h4",
			"h5",
			"h6",
		]);

		console.log(trans);

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

	const requiresChildrenElements: string[] = [
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
	removeEmptyElements(content, requiresChildrenElements);
	removeDuplicateElements(content);

	console.log(content.innerHTML);

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
		while (element.attributes.length > 0) {
			element.removeAttribute(element.attributes[0].name);
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
	requiresChildrenElements: string[],
): void => {
	const treeWalker = document.createTreeWalker(
		element,
		NodeFilter.SHOW_ELEMENT,
	);
	let currentNode: Node | null = treeWalker.currentNode;
	const emptyNodes = [];

	while (currentNode) {
		if (
			currentNode.textContent?.trim() === "" &&
			requiresChildrenElements.includes(currentNode.nodeName.toLowerCase())
		) {
			emptyNodes.push(currentNode);
		}
		currentNode = treeWalker.nextNode();
	}

	// remove found empty nodes
	for (const node of emptyNodes) {
		node.parentNode?.removeChild(node);
	}

	// print DOM
	console.log(document.body.firstElementChild?.outerHTML);
};

/**
 * 重複する要素を削除する
 * 子が1つで、かつその子が同じタグ名の場合、親要素を削除し、子要素を親要素の親要素に移動する
 *
 * @example
 * input:
 *
 * ```html
 * <div>
 *  <div>
 *    <p>foo</p>
 *    <p><p>bar</p></p>
 *  </div>
 * </div>
 * ```
 *
 * output:
 * ```html
 * <div>
 *  <p>foo</p>
 *  <p>bar</p>
 * </div>
 * ```
 */
const removeDuplicateElements = (element: Element): void => {
	const treeWalker = document.createTreeWalker(
		element,
		NodeFilter.SHOW_ELEMENT,
	);
	let currentNode: Node | null = treeWalker.currentNode;

	const replaceTargets: [Node, Node][] = [];

	while (currentNode) {
		if (currentNode.childNodes.length === 1) {
			const child = currentNode.childNodes[0];
			if (child.nodeName === currentNode.nodeName) {
				const parent = currentNode.parentNode;
				if (parent) {
					console.log("parent", parent);

					replaceTargets.push([currentNode, child]);
					// parent.replaceChild(child, currentNode);
				}
			}
		}
		currentNode = treeWalker.nextNode();
	}

	for (const [target, replacement] of replaceTargets) {
		target.parentNode?.replaceChild(replacement, target);
	}
};

const transcript = (
	originalRoot: Element,
	allowNodeNames: string[],
): Element => {
	const root = document.createElement(originalRoot.nodeName);

	if (
		originalRoot.childNodes.length === 1 &&
		originalRoot.nodeType === originalRoot.children[0]?.nodeType &&
		originalRoot.nodeName === originalRoot.children[0]?.nodeName
	) {
		console.log("skip", {
			nodeName: originalRoot.nodeName,
			nodeType: originalRoot.nodeType,
			child: originalRoot.children[0],
		});

		return transcript(originalRoot.children[0], allowNodeNames);
	}

	for (const node of originalRoot.childNodes) {
		console.log("node", {
			nodeName: node.nodeName,
			nodeType: node.nodeType,
			nodeValue: node.nodeValue,
			textContent: node.textContent,
		});

		if (node instanceof Element) {
			if (allowNodeNames.includes(node.nodeName.toLowerCase())) {
				const newNode = transcript(node, allowNodeNames);

				if (newNode.childNodes.length !== 0) {
					root.appendChild(newNode);
				}
			}
		} else if (node instanceof Text) {
			if (node.textContent?.trim() === "") {
				continue;
			}

			const text = document.createTextNode(node.textContent || "");
			root.appendChild(text);
		}
	}

	return root;
};
