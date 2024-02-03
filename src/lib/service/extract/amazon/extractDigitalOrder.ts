import { ExtractError } from "../extractError";
import type { ExtractedOrder, ExtractedProduct } from "../extractTypes";
import { parsePriceYen } from "../extractUtil";
import { extractOrderDate, extractOrderNumber } from "./extractOrderInfo";

export const extractDigitalOrder = (document: Document): ExtractedOrder => {
  const orderNumber = extractOrderNumber(document);
  const orderDate = extractOrderDate(document);
  const products = extractDigitalProducts(document);
  const pointPayment = extractPointPayment(document);

  return {
    orderNumber,
    orderDate,
    products: pointPayment ? [...products, pointPayment] : products,
  } satisfies ExtractedOrder;
};

export const extractDigitalProducts = (
  document: Document
): ExtractedProduct[] => {
  const tables = Array.from(document.querySelectorAll("tbody"));

  // 入れ子の一番下で"注文商品"という文字列を含むテーブルを抽出
  const productsTables = tables.filter(
    (table) =>
      table.textContent !== null &&
      table.querySelector("tbody") === null &&
      table.textContent.includes("注文商品")
  );

  return productsTables.flatMap((table) => {
    const trList = Array.from(table.querySelectorAll("tr"));
    // 一番上のtrは"注文商品"なので除外
    // 一番下のtrは"合計"なので除外
    return trList.slice(1, -1).map((tr) => {
      const productName = extractProductName(tr);
      const price = extractPrice(tr);
      return {
        productName,
        priceYen: price,
        quantity: 1,
      } satisfies ExtractedProduct;
    });
  });
};

// 商品名を取得する関数
const extractProductName = (tr: HTMLElement): string => {
  const productLink = tr.querySelector("a");
  if (productLink?.textContent == null) {
    throw new ExtractError({
      message: "商品名が取得できませんでした",
      element: tr,
    });
  }
  return productLink.textContent.trim();
};

// 価格を取得する関数
const extractPrice = (tr: HTMLElement): number => {
  const priceElement = tr.querySelector("td:last-child");
  const price = priceElement?.textContent?.trim();
  if (price === null || price === undefined) {
    throw new ExtractError({
      message: "価格が取得できませんでした",
      element: tr,
    });
  }
  return parsePriceYen(price);
};

const extractPointPayment = (
  document: Document
): ExtractedProduct | undefined => {
  const subtotalDivList = Array.from(
    document.getElementsByClassName("pmts-amount-breakdown-sub-totals")
  );

  const subtotalRowDiv = subtotalDivList.find((div) =>
    div.textContent?.includes("ポイント")
  );

  const priceDiv = subtotalRowDiv?.lastChild;
  if (priceDiv?.textContent == null) {
    return undefined;
  }
  return {
    productName: "ポイント",
    priceYen: parsePriceYen(priceDiv.textContent),
    quantity: 1,
  } satisfies ExtractedProduct;
};
