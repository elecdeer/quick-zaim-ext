import { defineHandler } from "void";

export const GET = defineHandler((c) => {
  const user = c.get("accessUser");
  return { email: user.email };
});
