export interface OrderProductExtra {
  orderProductExtraId: number;
  orderProductId: number;
  productId: number;
  name: string;
  unitPriceExVat: number;
  vatPercent: number;
  vatCode: string;
  quantity: number;
  discountPercent: number;
  extraType: string;
}

export interface OrderProduct {
  orderProductId: number;
  orderId: number;
  ticketId: number;
  name: string;
  unitPriceExVat: number;
  vatPercent: number;
  vatCode: string;
  quantity: number;
  feeSum: number;
  eventTicketCategoryId: number;
  discountPercent: number;
  organizerFee: number;
  status: string;
  comment: string;
  degreeOfCoverage: number;
  coverageContribution: number;
  productGroupUniqueId: string;
  supplierId: number;
  extras: OrderProductExtra[];
}

export interface ReceiptFormat {
  name: string;
  quantity: number;
  price: number;
  extras: {
    name: string;
    quantity: number;
    price: number;
  }[];
}
