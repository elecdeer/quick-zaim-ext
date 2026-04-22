import type { Meta, StoryObj } from "@storybook/react";
import ZaimLogin from "./ZaimLogin.tsx";

const meta = {
  title: "Components/ZaimLogin",
  component: ZaimLogin,
  args: {
    onConnect: () => {},
    onDisconnect: () => {},
    onRefresh: () => {},
  },
} satisfies Meta<typeof ZaimLogin>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NotConnected: Story = {
  args: {
    isConnected: false,
    zaimUserId: null,
    isLoading: false,
  },
};

export const Connected: Story = {
  args: {
    isConnected: true,
    zaimUserId: "zaim_user_123456",
    isLoading: false,
  },
};

export const ZaimLoadingState: Story = {
  args: {
    isConnected: false,
    zaimUserId: null,
    isLoading: true,
  },
};
