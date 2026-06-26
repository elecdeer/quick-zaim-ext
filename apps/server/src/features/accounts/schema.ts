import * as v from "valibot";

export const AccountsQuerySchema = v.object({
  no_cache: v.optional(v.string()),
});

export type Account = {
  id: number;
  name: string;
  modified: string;
  sort: number;
  active: number;
  localId: number;
  websiteId: number;
  parentAccountId: number;
};

export type AccountsResponse = {
  /** Zaim API からデータを取得した日時（ISO 8601） */
  fetchedAt: string;
  accounts: Account[];
};
