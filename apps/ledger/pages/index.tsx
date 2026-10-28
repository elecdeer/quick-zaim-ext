import type { Props } from "./index.server";

/**
 * 台帳 Web アプリのトップページ（スパイク用の仮画面）。
 */
const HomePage = ({ email, accounts }: Props) => (
  <main>
    <h1>Ledger</h1>
    <p>{email} でログイン中</p>
    <ul>
      {accounts.map((account) => (
        <li key={account.id}>{account.name}</li>
      ))}
    </ul>
  </main>
);

export default HomePage;
