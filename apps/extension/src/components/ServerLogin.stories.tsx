import preview from "../../.storybook/preview";
import ServerLogin from "./ServerLogin.tsx";

const meta = preview.meta({
  title: "Components/ServerLogin",
  component: ServerLogin,
  args: {
    onLogin: () => {},
    onLogout: () => {},
    onRefresh: () => {},
  },
});

export default meta;

export const NotLoggedIn = meta.story({
  args: {
    isAuthenticated: false,
    user: null,
    isLoading: false,
  },
});

export const LoggedIn = meta.story({
  args: {
    isAuthenticated: true,
    user: { email: "user@example.com", sub: "auth0|abc123" },
    isLoading: false,
  },
});

export const ServerLoadingState = meta.story({
  args: {
    isAuthenticated: false,
    user: null,
    isLoading: true,
  },
});
