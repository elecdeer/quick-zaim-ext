import { beforeAll } from "vite-plus/test";
import preview from "./.storybook/preview";

beforeAll(preview.composed.beforeAll);
