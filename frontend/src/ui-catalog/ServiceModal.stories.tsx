import type { Meta, StoryObj } from "@storybook/react-vite";
import { ServiceModalExample } from "./ServiceModalExample";

const meta = { title: "Zani/ServiceModal", component: ServiceModalExample } satisfies Meta<typeof ServiceModalExample>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Editable: Story = {};
export const Archived: Story = { args: { state: "archived" } };
export const SaveError: Story = { args: { state: "error" } };
export const Saving: Story = { args: { state: "saving" } };
