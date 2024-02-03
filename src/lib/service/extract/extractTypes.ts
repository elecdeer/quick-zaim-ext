export type ExtractedProduct = {
  productName: string;
  priceYen: number;
  quantity: number;
};

export type ExtractedOrder = {
  orderNumber: string;
  orderDate: Date;
  products: ExtractedProduct[];
};
