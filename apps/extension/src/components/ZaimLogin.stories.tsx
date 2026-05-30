import preview from "#storybook/preview";
import ZaimLogin from "./ZaimLogin.tsx";

const meta = preview.meta({
  title: "Components/ZaimLogin",
  component: ZaimLogin,
  args: {
    onConnect: () => {},
    onDisconnect: () => {},
    onRefresh: () => {},
  },
});

export default meta;

export const NotConnected = meta.story({
  args: {
    isConnected: false,
    zaimUserId: null,
    isLoading: false,
  },
});

export const Connected = meta.story({
  args: {
    isConnected: true,
    zaimUserId: "zaim_user_123456",
    isLoading: false,
  },
});

export const ZaimLoadingState = meta.story({
  args: {
    isConnected: false,
    zaimUserId: null,
    isLoading: true,
  },
});
