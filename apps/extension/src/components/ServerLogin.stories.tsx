import type { Meta, StoryObj } from "@storybook/react";
import ServerLogin from "./ServerLogin.tsx";

const meta = {
  title: "Components/ServerLogin",
  component: ServerLogin,
  args: {
    onLogin: () => {},
    onLogout: () => {},
    onRefresh: () => {},
  },
} satisfies Meta<typeof ServerLogin>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NotLoggedIn: Story = {
  args: {
    isAuthenticated: false,
    user: null,
    isLoading: false,
  },
};

export const LoggedIn: Story = {
  args: {
    isAuthenticated: true,
    user: { email: "user@example.com", sub: "auth0|abc123" },
    isLoading: false,
  },
};

export const ServerLoadingState: Story = {
  args: {
    isAuthenticated: false,
    user: null,
    isLoading: true,
  },
};
