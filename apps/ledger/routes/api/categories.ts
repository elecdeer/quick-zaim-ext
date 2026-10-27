import * as v from "valibot";
import { defineHandler } from "void";
import { db } from "void/db";
import { listCategories } from "../../src/ledger/masters.ts";

const CategoriesQuerySchema = v.object({
  mode: v.optional(v.picklist(["payment", "income"]), "payment"),
});

export const GET = defineHandler.withValidator({ query: CategoriesQuerySchema })(
  async (_c, { query }) => ({ categories: await listCategories(db, query.mode) }),
);
