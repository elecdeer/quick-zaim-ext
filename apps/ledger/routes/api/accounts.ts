import { defineHandler } from "void";
import { db } from "void/db";
import { listAccounts } from "../../src/ledger/masters.ts";

export const GET = defineHandler(async () => ({ accounts: await listAccounts(db) }));
