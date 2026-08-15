import { afterEach, describe, expect } from "vite-plus/test";
import { test } from "../test-utils/browser-test.ts";
import { generateAriaTree, renderAriaTree } from "./ariaSnapshot.ts";

/**
 * フィクスチャ DOM を document.body にマウントするヘルパー。
 */
const mountFixture = (html: string): HTMLElement => {
  const container = document.createElement("div");
  container.innerHTML = html;
  document.body.appendChild(container);
  return container;
};

afterEach(() => {
  document.body.replaceChildren();
});

describe("generateAriaTree", () => {
  test("button のロールと名前を取得する", () => {
    const root = mountFixture(`<button>OK</button>`);
    const tree = generateAriaTree(root);
    expect(tree.children).toHaveLength(1);
    expect(tree.children[0]).toMatchObject({ role: "button", name: "OK" });
  });

  test("href 付きの a タグから link を返す", () => {
    const root = mountFixture(`<a href="/x">Home</a>`);
    const tree = generateAriaTree(root);
    expect(tree.children[0]).toMatchObject({ role: "link", name: "Home" });
  });

  test("h2 を heading と level=2 で返す", () => {
    const root = mountFixture(`<h2>Title</h2>`);
    const tree = generateAriaTree(root);
    expect(tree.children[0]).toMatchObject({
      role: "heading",
      name: "Title",
      state: { level: 2 },
    });
  });

  test("label[for] から input の名前を解決する", () => {
    const root = mountFixture(`<label for="amt">金額</label><input id="amt" type="text">`);
    const tree = generateAriaTree(root);
    const textbox = tree.children.find((c) => c.role === "textbox");
    expect(textbox?.name).toBe("金額");
  });

  test("aria-label がテキストよりも優先される", () => {
    const root = mountFixture(`<button aria-label="Close">X</button>`);
    const tree = generateAriaTree(root);
    expect(tree.children[0]).toMatchObject({ role: "button", name: "Close" });
  });

  test("display:none, aria-hidden, hidden 属性の要素はスキップされる", () => {
    const root = mountFixture(`
      <div>
        <span style="display:none">A</span>
        <span aria-hidden="true">B</span>
        <span hidden>C</span>
        <span>visible</span>
      </div>
    `);
    const tree = generateAriaTree(root);
    const text = JSON.stringify(tree);
    expect(text).not.toContain("A");
    expect(text).not.toContain("B");
    expect(text).not.toContain("C");
    expect(text).toContain("visible");
  });

  test("checkbox の checked 状態を読み取る", () => {
    const root = mountFixture(`<input type="checkbox" checked>`);
    const tree = generateAriaTree(root);
    expect(tree.children[0]).toMatchObject({
      role: "checkbox",
      state: { checked: true },
    });
  });

  test("button の disabled 状態を読み取る", () => {
    const root = mountFixture(`<button disabled>送信</button>`);
    const tree = generateAriaTree(root);
    expect(tree.children[0]).toMatchObject({
      role: "button",
      name: "送信",
      state: { disabled: true },
    });
  });

  test("aria-expanded の状態を読み取る", () => {
    const root = mountFixture(`<div role="button" aria-expanded="true">menu</div>`);
    const tree = generateAriaTree(root);
    expect(tree.children[0]).toMatchObject({
      role: "button",
      state: { expanded: true },
    });
  });

  test("generic ノードは折り畳まれる", () => {
    const root = mountFixture(`<div><div><span>hi</span></div></div>`);
    const tree = generateAriaTree(root);
    expect(tree.role).toBe("generic");
    expect(tree.children).toEqual([{ role: "text", name: "hi", children: [] }]);
  });

  test("空白のみのテキストノードは除外される", () => {
    const root = mountFixture(`<div>  \n  </div>`);
    const tree = generateAriaTree(root);
    expect(tree.children).toEqual([]);
  });

  test("input の value が保持される", () => {
    const root = mountFixture(`<input type="text" value="hello">`);
    const tree = generateAriaTree(root);
    expect(tree.children[0]).toMatchObject({ role: "textbox", value: "hello" });
  });

  test("table の構造を rowgroup / row / columnheader / cell に展開する", () => {
    const root = mountFixture(`
      <table>
        <thead>
          <tr><th>商品</th><th>金額</th></tr>
        </thead>
        <tbody>
          <tr><td>りんご</td><td>120</td></tr>
          <tr><td>みかん</td><td>80</td></tr>
        </tbody>
      </table>
    `);
    const tree = generateAriaTree(root);
    expect(tree).toEqual({
      role: "generic",
      children: [
        {
          role: "table",
          children: [
            {
              role: "rowgroup",
              children: [
                {
                  role: "row",
                  children: [
                    { role: "columnheader", name: "商品", children: [] },
                    { role: "columnheader", name: "金額", children: [] },
                  ],
                },
              ],
            },
            {
              role: "rowgroup",
              children: [
                {
                  role: "row",
                  children: [
                    { role: "cell", name: "りんご", children: [] },
                    { role: "cell", name: "120", children: [] },
                  ],
                },
                {
                  role: "row",
                  children: [
                    { role: "cell", name: "みかん", children: [] },
                    { role: "cell", name: "80", children: [] },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });
  });

  test("role 属性で row や cell を上書きできる", () => {
    const root = mountFixture(`
      <div role="table">
        <div role="row">
          <div role="columnheader">名前</div>
          <div role="cell">値</div>
        </div>
      </div>
    `);
    const tree = generateAriaTree(root);
    expect(tree).toEqual({
      role: "generic",
      children: [
        {
          role: "table",
          children: [
            {
              role: "row",
              children: [
                { role: "columnheader", name: "名前", children: [] },
                { role: "cell", name: "値", children: [] },
              ],
            },
          ],
        },
      ],
    });
  });

  test("th[role=rowheader] の指定を読み取る", () => {
    const root = mountFixture(`
      <table>
        <tr><th role="rowheader">合計</th><td>1200</td></tr>
      </table>
    `);
    const tree = generateAriaTree(root);
    expect(tree).toEqual({
      role: "generic",
      children: [
        {
          role: "table",
          children: [
            {
              role: "rowgroup",
              children: [
                {
                  role: "row",
                  children: [
                    { role: "rowheader", name: "合計", children: [] },
                    { role: "cell", name: "1200", children: [] },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });
  });

  test("maxNodes で打ち切られる", () => {
    const root = mountFixture(`<ul><li>a</li><li>b</li><li>c</li><li>d</li></ul>`);
    const tree = generateAriaTree(root, { maxNodes: 3 });
    const allRoles: string[] = [];
    const collect = (node: {
      role: string;
      children: { role: string; children: unknown[] }[];
    }): void => {
      allRoles.push(node.role);
      for (const child of node.children) {
        collect(child as { role: string; children: { role: string; children: unknown[] }[] });
      }
    };
    collect(tree as { role: string; children: { role: string; children: unknown[] }[] });
    expect(allRoles.length).toBeLessThanOrEqual(3);
  });
});

describe("renderAriaTree", () => {
  test("小さな支払いフォームを YAML ライクに整形する", () => {
    const root = mountFixture(`
      <main>
        <h1>支払いを入力</h1>
        <label for="amt">金額</label>
        <input id="amt" type="text" value="1200">
        <button disabled>登録</button>
      </main>
    `);
    const tree = generateAriaTree(root);
    const rendered = renderAriaTree(tree);
    expect(rendered).toContain(`- main:`);
    expect(rendered).toContain(`- heading "支払いを入力" [level=1]`);
    expect(rendered).toContain(`- textbox "金額" (value: "1200")`);
    expect(rendered).toContain(`- button "登録" [disabled=true]`);
  });

  test("table を YAML ライクに整形する", () => {
    const root = mountFixture(`
      <table>
        <thead><tr><th>名前</th><th>金額</th></tr></thead>
        <tbody><tr><td>りんご</td><td>120</td></tr></tbody>
      </table>
    `);
    const tree = generateAriaTree(root);
    const rendered = renderAriaTree(tree);
    expect(rendered).toContain(`- table:`);
    expect(rendered).toContain(`- row:`);
    expect(rendered).toContain(`- columnheader "名前"`);
    expect(rendered).toContain(`- columnheader "金額"`);
    expect(rendered).toContain(`- cell "りんご"`);
    expect(rendered).toContain(`- cell "120"`);
  });

  test("子なしノードは末尾にコロンが付かない", () => {
    const root = mountFixture(`<button>OK</button>`);
    const tree = generateAriaTree(root);
    const rendered = renderAriaTree(tree);
    expect(rendered).toContain(`- button "OK"`);
    expect(rendered.split("\n").some((line) => line.endsWith(`"OK":`))).toBe(false);
  });
});
