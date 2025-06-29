/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// https://github.com/microsoft/playwright/blob/f70f92d5cdecbebd01b18886fd7d45d1c9e7d980/packages/playwright-core/src/utils/isomorphic/stringUtils.ts

let normalizedWhitespaceCache: Map<string, string> | undefined;

export function normalizeWhiteSpace(text: string): string {
	let result = normalizedWhitespaceCache?.get(text);
	if (result === undefined) {
		result = text
			.replace(/\u200b/g, "")
			.trim()
			.replace(/\s+/g, " ");
		normalizedWhitespaceCache?.set(text, result);
	}
	return result;
}
