import { zaimApi } from "./api";

export type ZaimAccountRes = {
  accounts: {
    id: number;
    name: string;
  }[];
  requested: string;
};

export const fetchZaimAccount = async (): Promise<ZaimAccountRes> => {
  return await zaimApi.get("home/account").json<ZaimAccountRes>();
};
