import { defineHandler, type InferProps } from "void";
import { asc, db } from "void/db";
import { accounts } from "@schema";

export type Props = InferProps<typeof loader>;

export const loader = defineHandler(async (c) => {
  const rows = await db.select().from(accounts).orderBy(asc(accounts.sort), asc(accounts.id));
  return { email: c.get("accessUser").email, accounts: rows };
});
