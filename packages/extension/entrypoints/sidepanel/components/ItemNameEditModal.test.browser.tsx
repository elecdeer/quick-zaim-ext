import type { Receipt } from "@repo/workers/client";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";

import { ItemNameEditModal } from "./ItemNameEditModal";

describe("ItemNameEditModal", () => {
	const mockItem: Receipt["items"][0] = {
		name: "原商品名",
		normalizedName: "正規化された商品名",
		category: "食費",
		categoryId: "1",
		priceYen: 100,
		amount: 1,
	};

	const mockProps = {
		isOpen: true,
		onClose: vi.fn(),
		item: mockItem,
		onSave: vi.fn(),
	};

	beforeEach(() => {
		vi.clearAllMocks();
	});

	test("モーダルが正しく表示される", () => {
		const screen = render(<ItemNameEditModal {...mockProps} />);

		// ダイアログタイトルの確認
		expect(screen.getByText("商品名編集")).toBeVisible();

		// ボタンの確認
		expect(screen.getByRole("button", { name: "キャンセル" })).toBeVisible();
		expect(screen.getByRole("button", { name: "保存" })).toBeVisible();
	});

	test("モーダルが閉じている時は表示されない", () => {
		const screen = render(<ItemNameEditModal {...mockProps} isOpen={false} />);

		expect(
			screen.container.querySelector('[role="dialog"]'),
		).not.toBeInTheDocument();
	});

	test("元の名前と正規化名が異なる場合、元の名前が表示される", () => {
		const screen = render(<ItemNameEditModal {...mockProps} />);

		expect(screen.getByText("元の名前:")).toBeVisible();
		expect(screen.getByText("原商品名")).toBeVisible();
	});

	test("元の名前と正規化名が同じ場合、元の名前は表示されない", () => {
		const itemWithSameName: Receipt["items"][0] = {
			...mockItem,
			name: "同じ名前",
			normalizedName: "同じ名前",
		};

		const screen = render(
			<ItemNameEditModal {...mockProps} item={itemWithSameName} />,
		);

		expect(screen.container.textContent).not.toContain("元の名前:");
	});

	test("キャンセルボタンをクリックするとonCloseが呼ばれる", async () => {
		const screen = render(<ItemNameEditModal {...mockProps} />);

		const cancelButton = screen.getByRole("button", { name: "キャンセル" });
		await cancelButton.click();

		expect(mockProps.onClose).toHaveBeenCalledTimes(1);
	});

	test("保存ボタンをクリックするとonSaveが呼ばれる", async () => {
		const screen = render(<ItemNameEditModal {...mockProps} />);

		// 保存ボタンをクリック
		const saveButton = screen.getByRole("button", { name: "保存" });
		await saveButton.click();

		// onSaveが呼ばれることを確認
		expect(mockProps.onSave).toHaveBeenCalledTimes(1);

		// onCloseも呼ばれることを確認
		expect(mockProps.onClose).toHaveBeenCalledTimes(1);
	});
});
