import preview from "#storybook/preview";
import MainScreen from "./MainScreen.tsx";

const meta = preview.meta({
  title: "Sidebar/Screens/MainScreen",
  component: MainScreen,
  decorators: [
    (Story) => (
      <div className="flex min-h-screen flex-col gap-4 bg-gray-50 p-4">
        <h1 className="text-lg font-bold text-gray-900">Quick Zaim</h1>
        <Story />
      </div>
    ),
  ],
});

export default meta;

export const Default = meta.story({
  name: "支払いフォーム",
});
