export type DemoScenario = "beauty" | "medical" | "services";

export type DemoScenarioConfig = {
  id: DemoScenario;
  labelKey: string;
  welcomeKey: string;
  clientMessageKey: string;
  slotsKey: string;
  confirmedKey: string;
  clientNameKey: string;
  initials: string;
  requestKey: string;
  managerKey: string;
  timeKeys: readonly [string, string];
  value: string;
};

export const demoScenarios: readonly DemoScenarioConfig[] = [
  {
    id: "beauty",
    labelKey: "businessType.beauty",
    welcomeKey: "landing.demo.scenario.beauty.welcome",
    clientMessageKey: "landing.demo.scenario.beauty.client",
    slotsKey: "landing.demo.scenario.beauty.slots",
    confirmedKey: "landing.demo.scenario.beauty.confirmed",
    clientNameKey: "landing.demo.scenario.beauty.name",
    initials: "АС",
    requestKey: "landing.demo.scenario.beauty.request",
    managerKey: "landing.demo.scenario.beauty.manager",
    timeKeys: ["landing.demo.scenario.beauty.time1", "landing.demo.scenario.beauty.time2"],
    value: "35 000 ₸",
  },
  {
    id: "medical",
    labelKey: "businessType.medical",
    welcomeKey: "landing.demo.scenario.medical.welcome",
    clientMessageKey: "landing.demo.scenario.medical.client",
    slotsKey: "landing.demo.scenario.medical.slots",
    confirmedKey: "landing.demo.scenario.medical.confirmed",
    clientNameKey: "landing.demo.scenario.medical.name",
    initials: "ДК",
    requestKey: "landing.demo.scenario.medical.request",
    managerKey: "landing.demo.scenario.medical.manager",
    timeKeys: ["landing.demo.scenario.medical.time1", "landing.demo.scenario.medical.time2"],
    value: "45 000 ₸",
  },
  {
    id: "services",
    labelKey: "businessType.other",
    welcomeKey: "landing.demo.scenario.services.welcome",
    clientMessageKey: "landing.demo.scenario.services.client",
    slotsKey: "landing.demo.scenario.services.slots",
    confirmedKey: "landing.demo.scenario.services.confirmed",
    clientNameKey: "landing.demo.scenario.services.name",
    initials: "МО",
    requestKey: "landing.demo.scenario.services.request",
    managerKey: "landing.demo.scenario.services.manager",
    timeKeys: ["landing.demo.scenario.services.time1", "landing.demo.scenario.services.time2"],
    value: "60 000 ₸",
  },
] as const;
