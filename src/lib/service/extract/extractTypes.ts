// ここの型はJSON化可能でなければならない

export type ExtractedProduct = {
  productName: string;
  priceYen: number;
  quantity: number;
};

export type ExtractedOrder = {
  orderNumber: string;
  /** YYYY-MM-dd */
  orderDate: string;
  products: ExtractedProduct[];
};
