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

export function escapeRegExp(s: string) {
	// From https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions#escaping
	return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // $& means the whole matched string
}

export function longestCommonSubstring(s1: string, s2: string): string {
	const n = s1.length;
	const m = s2.length;
	let maxLen = 0;
	let endingIndex = 0;

	// Initialize a 2D array with zeros
	const dp = Array(n + 1)
		.fill(null)
		.map(() => Array(m + 1).fill(0));

	// Build the dp table
	for (let i = 1; i <= n; i++) {
		for (let j = 1; j <= m; j++) {
			if (s1[i - 1] === s2[j - 1]) {
				dp[i][j] = dp[i - 1][j - 1] + 1;

				if (dp[i][j] > maxLen) {
					maxLen = dp[i][j];
					endingIndex = i;
				}
			}
		}
	}

	// Extract the longest common substring
	return s1.slice(endingIndex - maxLen, endingIndex);
}
