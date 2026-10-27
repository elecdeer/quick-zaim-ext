import { defineHandler } from "void";
import { db } from "void/db";
import { listPlaces } from "../../src/ledger/masters.ts";

export const GET = defineHandler(async () => ({ places: await listPlaces(db) }));
