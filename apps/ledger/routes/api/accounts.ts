import * as v from "valibot";
import { defineHandler } from "void";
import { asc, db } from "void/db";
import { accounts } from "@schema";

const CreateAccountBodySchema = v.object({
  name: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(100)),
});

export const GET = defineHandler(async () => {
  const rows = await db
    .select({ id: accounts.id, name: accounts.name })
    .from(accounts)
    .orderBy(asc(accounts.sort), asc(accounts.id));
  return { accounts: rows };
});

export const POST = defineHandler.withValidator({ body: CreateAccountBodySchema })(async (
  c,
  { body },
) => {
  const [created] = await db
    .insert(accounts)
    .values({ name: body.name })
    .returning({ id: accounts.id, name: accounts.name });
  c.status(201);
  return created;
});
