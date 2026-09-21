import type { Meta, StoryObj } from "@storybook/react-vite";
import { ServiceTableExample } from "./ServiceTableExample";

const meta = { title: "Zani/ServiceTable", component: ServiceTableExample } satisfies Meta<typeof ServiceTableExample>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Populated: Story = {};
export const Empty: Story = { args: { state: "empty" } };
export const Loading: Story = { args: { state: "loading" } };
