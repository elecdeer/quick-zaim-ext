import { produce } from "immer";
import type { PaymentRecords } from "./payment";

export type PaymentRecordFieldItem = {
  uid: string;
  itemName: string;
  // categoryAndGenre: { categoryId: string; genreId: string } | undefined;
  categoryId: string | undefined;
  genreId: string | undefined;
  price: number | undefined;
  quantity: number;
  touched: boolean;
};

type ValidPaymentRecordFieldItem = {
  uid: string;
  itemName: string;
  categoryId: string;
  genreId: string;
  price: number;
  quantity: number;
  touched: boolean;
};

export type PaymentRecordFieldsAction =
  | { type: "setItemName"; index: number; itemName: string }
  | { type: "setCategory"; index: number; categoryId: string; genreId: string }
  | { type: "setPrice"; index: number; price: number | undefined }
  | { type: "setQuantity"; index: number; quantity: number }
  | { type: "delete"; index: number }
  | {
      type: "bulkSet";
      items: Omit<PaymentRecordFieldItem, "uid" | "touched">[];
    }
  | { type: "reset" };

export const paymentRecordFieldsReducer = (
  state: PaymentRecordFieldItem[],
  action: PaymentRecordFieldsAction
): PaymentRecordFieldItem[] => {
  return produce(state, (draft) => {
    const appendIfLastItem = (index: number) => {
      if (index === draft.length - 1) {
        // 最後のレコードなら新しいレコードを追加
        // カテゴリは引き継ぐ
        draft.push({
          ...createDefaultRecord(),
          categoryId: draft[index].categoryId,
          genreId: draft[index].genreId,
        });
      }
    };

    const markTouched = (index: number) => {
      draft[index].touched = true;
    };

    switch (action.type) {
      case "setItemName":
        draft[action.index].itemName = action.itemName;
        appendIfLastItem(action.index);
        break;
      case "setCategory":
        appendIfLastItem(action.index);

        draft[action.index].categoryId = action.categoryId;
        draft[action.index].genreId = action.genreId;
        markTouched(action.index);

        // draft[action.index].categoryAndGenre = {
        //   categoryId: action.categoryId,
        //   genreId: action.genreId,
        // };

        // その下の未設定のレコードにも同じカテゴリとジャンルを設定する
        for (let i = action.index + 1; i < draft.length; i++) {
          if (draft[i].touched) continue;
          draft[i].categoryId = action.categoryId;
          draft[i].genreId = action.genreId;
        }

        break;
      case "setPrice":
        draft[action.index].price = action.price;
        appendIfLastItem(action.index);
        markTouched(action.index);
        break;
      case "setQuantity":
        draft[action.index].quantity = Math.max(0, action.quantity);
        appendIfLastItem(action.index);
        markTouched(action.index);
        break;
      case "delete":
        // 最後ならリセット
        if (draft.length === 1) {
          draft[0] = createDefaultRecord();
        } else {
          draft.splice(action.index, 1);
        }
        break;
      case "bulkSet":
        return action.items.map((item) => ({
          uid: createUid(),
          touched: true,
          ...item,
        }));
      case "reset":
        return initialPaymentRecordFields;
    }
  });
};

export const createUid = (): string => crypto.randomUUID();

const createDefaultRecord = (): PaymentRecordFieldItem => ({
  uid: createUid(),
  itemName: "",
  categoryId: undefined,
  genreId: undefined,
  price: undefined,
  quantity: 1,
  touched: false,
});

export const initialPaymentRecordFields: PaymentRecordFieldItem[] = [
  createDefaultRecord(),
];

export const createPaymentRequestFromFields = (
  fields: PaymentRecordFieldItem[]
): Pick<PaymentRecords, "items"> => {
  return {
    items: fields
      .filter(
        (record): record is ValidPaymentRecordFieldItem =>
          record.itemName !== "" &&
          record.price !== undefined &&
          record.categoryId !== undefined &&
          record.genreId !== undefined
      )
      .map((record) => ({
        uid: record.uid,
        itemName: record.itemName,
        categoryId: Number(record.categoryId),
        genreId: Number(record.genreId),
        pricePerItem: record.price,
        quantity: record.quantity,
      })),
  };
};
