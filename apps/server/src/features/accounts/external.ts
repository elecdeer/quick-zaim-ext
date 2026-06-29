import { accountGetAccounts } from "@repo/zaim-api";
import type { createClient } from "@repo/zaim-api/client";
import type { Logger } from "../../loggerMiddleware.ts";
import type { AccountsResponse } from "./schema.ts";

/**
 * Zaim API から口座一覧を取得してマッピングする。
 */
export const fetchAccountsFromZaim = async (
  client: ReturnType<typeof createClient>,
  logger: Logger,
): Promise<AccountsResponse> => {
  logger.debug("Fetching accounts from Zaim API");

  const result = await accountGetAccounts({
    client,
    query: { mapping: 1 },
  });

  if (!result.data) {
    logger.error("Failed to fetch accounts from Zaim API");
    throw new Error("Failed to fetch accounts from Zaim API");
  }

  const accountCount = result.data.accounts.length;
  logger.with({ accountCount }).debug("Zaim API returned {accountCount} accounts");

  return {
    fetchedAt: new Date().toISOString(),
    accounts: result.data.accounts.map((account) => ({
      id: account.id,
      name: account.name,
      modified: account.modified,
      sort: account.sort,
      active: account.active,
      localId: account.local_id,
      websiteId: account.website_id,
      parentAccountId: account.parent_account_id,
    })),
  };
};
