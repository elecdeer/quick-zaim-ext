import preview from "#storybook/preview";
import { beforeAll } from "vite-plus/test";

beforeAll(preview.composed.beforeAll);
