import { useState } from "react";
import preview from "#storybook/preview";
import { setupBrowserMock } from "../test-utils/browser-mock.ts";
import { meHandler, MOCK_SERVER_URL, unauthenticatedHandler } from "../test-utils/ledgerMocks.ts";
import { SettingsOverlay } from "./SettingsOverlay.tsx";

const ControlledWrapper = () => {
  const [open, setOpen] = useState(true);
  return (
    <div className="p-4">
      <button
        type="button"
        className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white"
        onClick={() => setOpen(true)}
      >
        設定を開く
      </button>
      <SettingsOverlay open={open} onOpenChange={setOpen} />
    </div>
  );
};

const meta = preview.meta({
  title: "Components/SettingsOverlay",
  component: SettingsOverlay,
  args: {
    open: true,
    onOpenChange: () => {},
  },
  decorators: [() => <ControlledWrapper />],
  loaders: [
    async (ctx) => {
      const serverUrl = (ctx.parameters.serverUrl as string | undefined) ?? MOCK_SERVER_URL;
      await setupBrowserMock({ serverUrl });
    },
  ],
});

export default meta;

export const NoServerUrl = meta.story({
  name: "URLなし",
  parameters: {
    serverUrl: "",
    msw: { handlers: [] },
  },
});

export const NotLoggedIn = meta.story({
  name: "未ログイン",
  parameters: {
    msw: {
      handlers: [unauthenticatedHandler],
    },
  },
});

export const LoggedIn = meta.story({
  name: "ログイン済み",
  parameters: {
    msw: {
      handlers: [meHandler],
    },
  },
});
