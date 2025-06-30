import { describe, expect, test } from "vitest";
import { render } from "vitest-browser-react";

describe("Button", () => {
	test("should render correctly", () => {
		const screen = render(<button type="button">Click Me</button>);

		expect(screen.getByRole("button")).toBeVisible();
	});
});
