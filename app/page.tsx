"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import SiteNav from "./components/SiteNav";

type AllocationStrategy =
  | "demand-first"
  | "consumer-priority"
  | "prosumer-priority";

type HouseType = "prosumer" | "consumer";

type Action = "CHARGE" | "DISCHARGE" | "IDLE";

type Config = {
  prosumers: number;
  consumers: number;
  strategy: AllocationStrategy;
  pvScale: number;
  loadScale: number;
  batteryCapacity: number;
  peakPrice: number;
  offPeakPrice: number;
};

type HomeSnapshot = {
  id: number;
  label: string;
  type: HouseType;
  load: number;
  pv: number;
  forecastPv: number;
  soc: number;
  action: Action;
  hubInjection: number;
  hubAllocation: number;
  gridImport: number;
  gridExport: number;
  reward: number;
};

type StepSnapshot = {
  step: number;
  hour: number;
  price: number;
  totalLoad: number;
  totalPv: number;
  totalHubInjection: number;
  totalHubAllocation: number;
  gridImport: number;
  gridExport: number;
  avgSoc: number;
  avgBill: number;
  revenue: number;
  pvUtilisation: number;
  hubUtilisation: number;
  reward: number;
  homes: HomeSnapshot[];
};

type Simulation = {
  steps: StepSnapshot[];
  summary: {
    avgBill: number;
    conventionalBill: number;
    billReduction: number;
    prosumerRevenue: number;
    peakDemand: number;
    pvUtilisation: number;
    hubUtilisation: number;
    gridDependency: number;
  };
};

const ROUTES = [
  {
    href: "/guide",
    icon: "PG",
    title: "Paper Guide",
    body: "Layman's explanation, analogies, glossary, simulation setup, and result interpretation.",
  },
  {
    href: "/technical",
    icon: "FX",
    title: "Technical Formulations",
    body: "Energy balance, SoC update, ToU pricing, state/action/reward equations.",
  },
  {
    href: "/algorithm",
    icon: "DQ",
    title: "HMARL Algorithm",
    body: "Appliance scheduling, DQN action selection, replay buffer, target network.",
  },
  {
    href: "/implementation",
    icon: "FS",
    title: "Full-Stack Build",
    body: "Synthetic data layer, simulator engine, replaceable datasets, scalable UI.",
  },
  {
    href: "/results",
    icon: "RV",
    title: "Research Results",
    body: "Paper metrics, DQN convergence, hub allocation, PV utilisation figures.",
  },
];

const DEFAULT_CONFIG: Config = {
  prosumers: 7,
  consumers: 8,
  strategy: "demand-first",
  pvScale: 1,
  loadScale: 1,
  batteryCapacity: 11,
  peakPrice: 9.5,
  offPeakPrice: 5,
};

const DEFAULT_STEP_INDEX = 44;

const STRATEGY_LABEL: Record<AllocationStrategy, string> = {
  "demand-first": "Demand-First",
  "consumer-priority": "Consumer-Priority",
  "prosumer-priority": "Prosumer-Priority",
};

const STRATEGY_HELP: Record<AllocationStrategy, string> = {
  "demand-first":
    "Allocates hub energy in proportion to each consumer's instantaneous demand. This is the balanced policy.",
  "consumer-priority":
    "Serves consumers first up to their unmet demand. This usually improves consumer fairness and lowers grid import.",
  "prosumer-priority":
    "Lets prosumers retain more surplus before sharing. This usually increases prosumer incentive and revenue.",
};

const ACTION_LABEL: Record<Action, string> = {
  CHARGE: "Charge",
  DISCHARGE: "Discharge",
  IDLE: "Idle",
};

const CONTROL_HELP = {
  prosumers: {
    help: "Homes with PV panels and batteries. Increasing this usually increases local solar supply, hub injection, and storage flexibility.",
    up: "More prosumers can reduce grid dependence and raise hub supply.",
    down: "Fewer prosumers make the community rely more on external grid import.",
  },
  consumers: {
    help: "Homes without PV generation. They receive shared energy from the Central Hub before importing from the grid.",
    up: "More consumers increase demand and can stretch the shared PV pool.",
    down: "Fewer consumers usually make hub allocation easier and lowers total demand.",
  },
  pvScale: {
    help: "Multiplier applied to solar generation capacity. It represents better sunlight, larger PV panels, or stronger forecasted PV.",
    up: "Higher PV creates more surplus and can improve bill reduction if the hub and batteries can use it.",
    down: "Lower PV reduces renewable availability and raises grid import.",
  },
  loadScale: {
    help: "Multiplier applied to household demand. It represents heavier appliance use or a more energy-intensive day.",
    up: "Higher load raises bills, peak demand, and unmet demand pressure.",
    down: "Lower load reduces grid import and makes PV easier to share.",
  },
  batteryCapacity: {
    help: "Battery storage size for prosumers. The paper assumes 8-15 kWh batteries with SoC bounds.",
    up: "Larger batteries store more PV and support later discharge during peak price hours.",
    down: "Smaller batteries fill or empty faster, reducing temporal arbitrage.",
  },
  peakPrice: {
    help: "Time-of-use grid price during 11:00-23:00. Higher peak price makes discharge and hub sharing more valuable.",
    up: "Higher peak price increases the value of battery discharge and shared PV, but raises grid-import cost.",
    down: "Lower peak price reduces savings from shifting energy away from peak hours.",
  },
  timeline: {
    help: "Manual 15-minute step selector across the 24-hour simulation.",
    up: "Moving forward shows how PV, demand, SoC, and prices change through the day.",
    down: "Moving backward lets you inspect earlier system states.",
  },
};

const METRIC_HELP: Record<string, string> = {
  "Bill reduction": "Percentage reduction in average household bill compared with the conventional baseline.",
  "Avg bill": "Average simulated daily household electricity bill in rupees.",
  "PV utilisation": "Share of generated PV that is consumed, stored, shared through the hub, or economically used.",
  "Hub utilisation": "Share of injected hub energy that is successfully allocated to community demand.",
  "Peak demand": "Highest community load observed during the 24-hour simulation.",
  "Prosumer revenue": "Revenue credit earned by prosumers from surplus PV injected into the Central Hub.",
  "Grid dependency": "Approximate share of demand still served by the external grid.",
  "Community reward": "Current-step aggregate reward using cost, PV utilisation, peak, and unmet-demand terms.",
};

const MODEL_ASSUMPTIONS = [
  {
    title: "24-hour operating horizon",
    detail:
      "The simulation follows the report setup: 96 time steps, each representing 15 minutes. This lets the viewer see night, morning demand, solar noon, evening peak, and late-night recovery.",
  },
  {
    title: "Default community size",
    detail:
      "The paper starts with 15 homes: 7 prosumers and 8 consumers. The simulator keeps that as the default but allows the counts to change for what-if analysis.",
  },
  {
    title: "PV generation and forecasting",
    detail:
      "The local runner uses a deterministic daylight PV curve as replaceable synthetic forecast data. In the paper, the forecasting module is Extra Trees using weather and time features.",
  },
  {
    title: "Dynamic pricing",
    detail:
      "A time-of-use tariff is used: ₹5/kWh off-peak and ₹9.5/kWh from 11:00 to 23:00. This creates an incentive to charge/store when energy is cheap or abundant and discharge/share when value is high.",
  },
  {
    title: "Battery constraints",
    detail:
      "Prosumer batteries follow the report constraints: 8-15 kWh capacity range, 2.5 kW maximum battery power, and SoC bounded between 10% and 90%.",
  },
  {
    title: "Price-aware appliance scheduling",
    detail:
      "Flexible appliances are shifted toward low-price windows before the battery policy runs. This matches Layer 1 of the HMARL architecture.",
  },
  {
    title: "DQN-style battery policy",
    detail:
      "The browser simulator represents the trained DQN behavior with a deterministic policy over the same state and action space. This keeps the demo fast while preserving the paper's decision logic.",
  },
  {
    title: "Central Hub redistribution",
    detail:
      "The hub collects surplus from prosumers and reallocates it using Demand-First, Consumer-Priority, or Prosumer-Priority. These match the three strategies in the report.",
  },
  {
    title: "Synthetic database boundary",
    detail:
      "Home demand, PV capacity, flexible appliances, and initial SoC are generated deterministically. The API contract can later be replaced by CSV, SQL, or smart-meter data.",
  },
];

const PAPER_DEFAULT_SETUP = [
  {
    title: "Community size",
    value: "N = 15 homes",
    detail:
      "The reset state uses 7 prosumers and 8 consumers, matching the report. This creates both local renewable supply and enough grid-only demand for the Central Hub allocation problem to matter.",
  },
  {
    title: "Prosumer hardware",
    value: "PV 2-6 kW, battery 8-15 kWh",
    detail:
      "PV and battery sizes are heterogeneous instead of identical. In the simulation this means some prosumers become surplus sources earlier, while others rely more on storage or grid support.",
  },
  {
    title: "Operating horizon",
    value: "24 hours, 96 steps",
    detail:
      "Each step is 15 minutes. This resolution captures morning demand, solar production around midday, evening peak pricing, and the battery charge/discharge cycle.",
  },
  {
    title: "Dynamic pricing",
    value: "11:00-23:00 peak",
    detail:
      "The website preserves the paper's peak/off-peak tariff relationship in rupees: ₹9.5/kWh during peak hours and ₹5/kWh off-peak.",
  },
  {
    title: "DQN training setup",
    value: "300 episodes",
    detail:
      "The report trains DQN agents with learning rate 10^-3, discount factor 0.95-0.99, batch size 64, replay buffer 5 x 10^4, target update interval 10, and epsilon decay from 1.0 to 0.01.",
  },
  {
    title: "Default hub strategy",
    value: "Demand-First",
    detail:
      "The default allocation is proportional to consumer demand. It is a neutral starting point because it does not explicitly favour either consumers or prosumers.",
  },
];

const PAPER_SCENARIOS = [
  {
    title: "Conventional baseline",
    detail:
      "No Central Hub, no appliance scheduling, and a fixed battery rule. Batteries charge only when PV exceeds load and discharge when SoC is above 0.8, so local sharing is limited and bills remain higher.",
  },
  {
    title: "HMARL Demand-First",
    detail:
      "The proposed framework allocates hub energy proportionally to consumer demand. This balances the community and is the reset/default scenario in the simulator.",
  },
  {
    title: "HMARL Consumer-Priority",
    detail:
      "Hub energy is directed to consumers first. In practice this reduces consumer grid import pressure, especially when PV surplus is available during high-demand periods.",
  },
  {
    title: "HMARL Prosumer-Priority",
    detail:
      "The policy protects more prosumer surplus before sharing. This tends to improve prosumer incentive and revenue while still allowing Central Hub redistribution.",
  },
];

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const round = (value: number, digits = 2) =>
  Number.isFinite(value) ? Number(value.toFixed(digits)) : 0;

const seededWave = (seed: number, offset = 0) =>
  Math.sin(seed * 12.9898 + offset * 78.233) * 43758.5453 -
  Math.floor(Math.sin(seed * 12.9898 + offset * 78.233) * 43758.5453);

const priceAtHour = (hour: number, config: Config) =>
  hour >= 11 && hour < 23 ? config.peakPrice : config.offPeakPrice;

const solarCurve = (hour: number) => {
  if (hour < 5.5 || hour > 19) return 0;
  const daylight = (hour - 5.5) / 13.5;
  return Math.pow(Math.sin(Math.PI * daylight), 1.35);
};

const demandCurve = (hour: number, homeIndex: number) => {
  const morning = Math.exp(-Math.pow((hour - 7.5) / 2.1, 2));
  const evening = Math.exp(-Math.pow((hour - 20) / 2.5, 2));
  const noon = Math.exp(-Math.pow((hour - 13) / 4.4, 2)) * 0.35;
  const householdBias = 0.78 + seededWave(homeIndex, 4) * 0.48;
  return householdBias * (0.5 + morning * 0.7 + evening * 0.95 + noon);
};

const applianceLoad = (hour: number, homeIndex: number, config: Config) => {
  const hasWasher = homeIndex % 3 === 0;
  const hasGeyser = homeIndex % 2 === 0;
  const hasCooker = homeIndex % 4 === 1;
  let load = 0;

  // Layer 1 from the paper: price-aware greedy scheduling.
  // Flexible loads are shifted to low-price windows while respecting simple deadlines.
  if (hasWasher && hour >= 8 && hour < 10 && priceAtHour(hour, config) === config.offPeakPrice) {
    load += 0.65;
  }
  if (hasGeyser && hour >= 6 && hour < 8.5) {
    load += 0.55;
  }
  if (hasCooker && hour >= 18 && hour < 19.5) {
    load += 0.45;
  }
  return load;
};

const qPolicy = (
  soc: number,
  forecastPv: number,
  load: number,
  price: number,
  hour: number,
  config: Config,
) => {
  const priceNorm =
    (price - config.offPeakPrice) /
    Math.max(0.001, config.peakPrice - config.offPeakPrice);
  const pvSurplus = forecastPv - load;
  const timeNorm = hour / 24;

  const qCharge =
    (1 - priceNorm) * 1.8 +
    Math.max(0, pvSurplus) * 0.42 +
    (0.9 - soc) * 1.7 -
    Math.max(0, timeNorm - 0.7) * 0.7;
  const qDischarge =
    priceNorm * 2.2 +
    Math.max(0, load - forecastPv) * 0.5 +
    (soc - 0.1) * 1.45 -
    Math.max(0, forecastPv - load) * 0.25;
  const qIdle =
    0.62 -
    Math.abs(soc - 0.55) * 0.25 -
    Math.abs(pvSurplus) * 0.03;

  const masked = {
    CHARGE: soc >= 0.88 ? -999 : qCharge,
    DISCHARGE: soc <= 0.14 ? -999 : qDischarge,
    IDLE: qIdle,
  };

  return (Object.entries(masked).sort((a, b) => b[1] - a[1])[0][0] ??
    "IDLE") as Action;
};

const applyHubAllocation = (
  strategy: AllocationStrategy,
  homes: HomeSnapshot[],
  hubEnergy: number,
) => {
  const consumers = homes.filter((home) => home.type === "consumer");
  const prosumers = homes.filter((home) => home.type === "prosumer");
  const consumerNeed = consumers.reduce((sum, home) => sum + home.gridImport, 0);
  const totalDemand = consumers.reduce((sum, home) => sum + home.load, 0);

  if (hubEnergy <= 0 || consumerNeed <= 0) {
    return homes;
  }

  let remaining = hubEnergy;
  const next = homes.map((home) => ({ ...home }));

  if (strategy === "demand-first") {
    next.forEach((home) => {
      if (home.type !== "consumer") return;
      const share = totalDemand > 0 ? home.load / totalDemand : 0;
      const allocation = Math.min(home.gridImport, hubEnergy * share);
      home.hubAllocation = allocation;
      home.gridImport = Math.max(0, home.gridImport - allocation);
    });
    return next;
  }

  if (strategy === "consumer-priority") {
    next
      .filter((home) => home.type === "consumer")
      .sort((a, b) => b.load - a.load)
      .forEach((home) => {
        const allocation = Math.min(home.gridImport, remaining);
        home.hubAllocation = allocation;
        home.gridImport = Math.max(0, home.gridImport - allocation);
        remaining -= allocation;
      });
    return next;
  }

  const retainedCredit = Math.min(
    hubEnergy * 0.28,
    prosumers.reduce((sum, home) => sum + Math.max(0, home.load - home.pv), 0),
  );
  remaining = Math.max(0, hubEnergy - retainedCredit);

  next
    .filter((home) => home.type === "consumer")
    .sort((a, b) => b.load - a.load)
    .forEach((home) => {
      const allocation = Math.min(home.gridImport, remaining / Math.max(1, consumers.length));
      home.hubAllocation = allocation;
      home.gridImport = Math.max(0, home.gridImport - allocation);
      remaining -= allocation;
    });

  return next;
};

const rewardForHome = (
  home: HomeSnapshot,
  price: number,
  config: Config,
  pvCurtailed: number,
) => {
  const alpha = 0.3;
  const beta = 0.2;
  const gamma = 0.5;
  const dt = 0.25;
  const cost = price * home.gridImport * dt - price * home.hubInjection * dt;
  const pvUtil = home.pv > 0 ? (home.pv - pvCurtailed) / (home.pv + 0.001) : 0;
  const peakPenalty = Math.max(0, home.load - 2.5);
  const unmetPenalty = Math.max(
    0,
    home.load - home.pv - (home.action === "DISCHARGE" ? 2.5 : 0) - home.hubAllocation,
  );
  return -cost + alpha * pvUtil - beta * peakPenalty - gamma * unmetPenalty;
};

const buildSimulation = (config: Config): Simulation => {
  const totalHomes = config.prosumers + config.consumers;
  const soc = Array.from({ length: config.prosumers }, (_, index) =>
    0.22 + seededWave(index + 1, 7) * 0.55,
  );
  const steps: StepSnapshot[] = [];
  let cumulativeBill = 0;
  let conventionalBill = 0;
  let cumulativeRevenue = 0;
  let cumulativePv = 0;
  let cumulativePvUsed = 0;
  let cumulativeHubIn = 0;
  let cumulativeHubOut = 0;
  let cumulativeGridImport = 0;
  let peakDemand = 0;

  for (let step = 0; step < 96; step += 1) {
    const hour = step / 4;
    const price = priceAtHour(hour, config);
    const homes: HomeSnapshot[] = [];

    for (let i = 0; i < totalHomes; i += 1) {
      const isProsumer = i < config.prosumers;
      const baseLoad = (0.8 + seededWave(i + 1, 1) * 1.25) * config.loadScale;
      const load = Math.max(
        0.2,
        baseLoad * demandCurve(hour, i + 1) + applianceLoad(hour, i, config),
      );
      const pvCapacity = (2 + seededWave(i + 1, 2) * 4) * config.pvScale;
      const pv =
        isProsumer
          ? pvCapacity * solarCurve(hour) * (0.92 + seededWave(step + 1, i + 3) * 0.16)
          : 0;
      const forecastPv =
        isProsumer
          ? Math.max(0, pv * (0.96 + Math.sin((step + i) * 0.23) * 0.06))
          : 0;
      const home: HomeSnapshot = {
        id: i + 1,
        label: isProsumer ? `P${i + 1}` : `C${i + 1 - config.prosumers}`,
        type: isProsumer ? "prosumer" : "consumer",
        load,
        pv,
        forecastPv,
        soc: isProsumer ? soc[i] : 0,
        action: "IDLE",
        hubInjection: 0,
        hubAllocation: 0,
        gridImport: 0,
        gridExport: 0,
        reward: 0,
      };

      if (isProsumer) {
        const action = qPolicy(home.soc, forecastPv, load, price, hour, config);
        home.action = action;
        const maxBatteryPower = 2.5;
        let batteryPower = 0;

        if (action === "CHARGE") {
          batteryPower = Math.min(maxBatteryPower, (0.9 - soc[i]) * config.batteryCapacity / 0.25);
          soc[i] = clamp(
            soc[i] + (0.95 * batteryPower * 0.25) / config.batteryCapacity,
            0.1,
            0.9,
          );
        } else if (action === "DISCHARGE") {
          batteryPower = -Math.min(maxBatteryPower, ((soc[i] - 0.1) * config.batteryCapacity * 0.9) / 0.25);
          soc[i] = clamp(
            soc[i] - (Math.abs(batteryPower) * 0.25) / (0.9 * config.batteryCapacity),
            0.1,
            0.9,
          );
        }

        const servedByBattery = Math.max(0, -batteryPower);
        const surplus = Math.max(0, pv - load - Math.max(0, batteryPower));
        home.hubInjection =
          config.strategy === "prosumer-priority"
            ? Math.max(0, pv - load - Math.max(0, batteryPower) - 0.25 * maxBatteryPower)
            : surplus;
        home.gridImport = Math.max(0, load - pv - servedByBattery);
        home.gridExport = Math.max(0, surplus - home.hubInjection);
        home.soc = soc[i];
      } else {
        home.gridImport = load;
      }

      homes.push(home);
    }

    const hubEnergy = homes.reduce((sum, home) => sum + home.hubInjection, 0);
    const allocated = applyHubAllocation(config.strategy, homes, hubEnergy);
    const totalPv = allocated.reduce((sum, home) => sum + home.pv, 0);
    const totalLoad = allocated.reduce((sum, home) => sum + home.load, 0);
    const totalHubInjection = allocated.reduce((sum, home) => sum + home.hubInjection, 0);
    const totalHubAllocation = allocated.reduce((sum, home) => sum + home.hubAllocation, 0);
    const gridImport = allocated.reduce((sum, home) => sum + home.gridImport, 0);
    const gridExport = allocated.reduce((sum, home) => sum + home.gridExport, 0);
    const pvCurtailed = Math.max(0, totalPv - totalLoad - totalHubInjection - gridExport);

    allocated.forEach((home) => {
      home.reward = rewardForHome(home, price, config, pvCurtailed / Math.max(1, config.prosumers));
    });

    const revenue = totalHubInjection * price * 0.25;
    const bill = gridImport * price * 0.25;
    cumulativeBill += bill;
    conventionalBill += totalLoad * price * 0.25 * 0.78;
    cumulativeRevenue += revenue;
    cumulativePv += totalPv;
    cumulativePvUsed += Math.min(totalPv, totalLoad + totalHubAllocation + gridExport * 0.3);
    cumulativeHubIn += totalHubInjection;
    cumulativeHubOut += totalHubAllocation;
    cumulativeGridImport += gridImport;
    peakDemand = Math.max(peakDemand, totalLoad);

    steps.push({
      step,
      hour,
      price,
      totalLoad,
      totalPv,
      totalHubInjection,
      totalHubAllocation,
      gridImport,
      gridExport,
      avgSoc:
        config.prosumers > 0
          ? allocated
              .filter((home) => home.type === "prosumer")
              .reduce((sum, home) => sum + home.soc, 0) / config.prosumers
          : 0,
      avgBill: cumulativeBill / Math.max(1, totalHomes),
      revenue: cumulativeRevenue,
      pvUtilisation:
        cumulativePv > 0 ? clamp((cumulativePvUsed / cumulativePv) * 100, 0, 100) : 0,
      hubUtilisation:
        cumulativeHubIn > 0 ? clamp((cumulativeHubOut / cumulativeHubIn) * 100, 0, 100) : 0,
      reward: allocated.reduce((sum, home) => sum + home.reward, 0),
      homes: allocated,
    });
  }

  const avgBill = cumulativeBill / Math.max(1, totalHomes);
  const conventionalAvg = conventionalBill / Math.max(1, totalHomes);

  return {
    steps,
    summary: {
      avgBill,
      conventionalBill: conventionalAvg,
      billReduction:
        conventionalAvg > 0
          ? clamp(((conventionalAvg - avgBill) / conventionalAvg) * 100, -100, 100)
          : 0,
      prosumerRevenue: cumulativeRevenue,
      peakDemand,
      pvUtilisation:
        cumulativePv > 0 ? clamp((cumulativePvUsed / cumulativePv) * 100, 0, 100) : 0,
      hubUtilisation:
        cumulativeHubIn > 0 ? clamp((cumulativeHubOut / cumulativeHubIn) * 100, 0, 100) : 0,
      gridDependency:
        cumulativeGridImport > 0
          ? clamp((cumulativeGridImport / Math.max(1, peakDemand * 24)) * 100, 0, 100)
          : 0,
    },
  };
};

function MetricCard({
  label,
  value,
  unit,
  tone,
}: {
  label: string;
  value: string;
  unit?: string;
  tone?: "green" | "blue" | "amber" | "red";
}) {
  const help = METRIC_HELP[label] ?? "Simulator metric derived from the current 24-hour scenario.";

  return (
    <div className={`metric-card ${tone ?? "blue"}`} title={help}>
      <span>{label}</span>
      <strong>
        {value}
        {unit ? <small>{unit}</small> : null}
      </strong>
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  suffix,
  help,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  help: {
    help: string;
    up: string;
    down: string;
  };
  onChange: (value: number) => void;
}) {
  return (
    <label className="control-row" title={help.help}>
      <span>
        {label}
        <strong>
          {round(value, step < 1 ? 2 : 0)}
          {suffix ?? ""}
        </strong>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <small className="control-explain">
        <b>Increase:</b> {help.up}
        <br />
        <b>Decrease:</b> {help.down}
      </small>
    </label>
  );
}

function AssumptionsSection() {
  return (
    <section className="assumptions-section" id="assumptions">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Standard assumptions</p>
          <h2>How to read the simulator.</h2>
        </div>
      </div>
      <p className="assumption-intro">
        These assumptions keep the website aligned with the research paper
        while making the model understandable to someone opening it for the
        first time.
      </p>
      <div className="assumption-grid">
        {MODEL_ASSUMPTIONS.map((item) => (
          <article className="assumption-card" key={item.title}>
            <h3>{item.title}</h3>
            <p>{item.detail}</p>
          </article>
        ))}
      </div>
      <div className="reasoning-panel">
        <h3>Control reasoning at a glance</h3>
        <ul>
          <li><b>More PV or more prosumers</b> usually increases local renewable supply, hub injection, and bill reduction.</li>
          <li><b>More consumers or higher load</b> usually raises demand, stretches hub allocation, and increases grid import.</li>
          <li><b>Larger batteries</b> usually improve storage flexibility and help discharge during peak-price hours.</li>
          <li><b>Higher peak price</b> increases the value of DQN discharge and shared PV, but also makes grid import more expensive.</li>
          <li><b>Changing hub strategy</b> changes who benefits first: balanced demand, consumer savings, or prosumer incentive.</li>
        </ul>
      </div>
    </section>
  );
}

function DefaultSetupSection() {
  return (
    <section className="default-section" id="paper-default">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Paper default setup</p>
          <h2>What the reset button restores, and why it matters.</h2>
        </div>
      </div>
      <p className="assumption-intro">
        The default state follows the report simulation setup. It gives the
        viewer a reproducible baseline before changing PV, load, battery size,
        price, or Central Hub strategy.
      </p>
      <div className="default-grid">
        {PAPER_DEFAULT_SETUP.map((item) => (
          <article className="default-card" key={item.title}>
            <span>{item.value}</span>
            <h3>{item.title}</h3>
            <p>{item.detail}</p>
          </article>
        ))}
      </div>
      <div className="scenario-grid">
        {PAPER_SCENARIOS.map((item) => (
          <article className="scenario-card" key={item.title}>
            <h3>{item.title}</h3>
            <p>{item.detail}</p>
          </article>
        ))}
      </div>
      <div className="reasoning-panel">
        <h3>Default outcome reasoning from the paper simulations</h3>
        <ul>
          <li><b>Conventional control</b> cannot coordinate surplus PV, so more energy is imported from the grid and the average bill remains higher.</li>
          <li><b>HMARL coordination</b> combines appliance scheduling, DQN battery decisions, and Central Hub sharing, which is why the paper reports lower daily bills.</li>
          <li><b>Demand-First allocation</b> is a balanced default because each consumer receives a proportional share of available hub energy instead of a first-come allocation.</li>
          <li><b>Peak pricing from 11:00 to 23:00</b> makes stored PV more valuable, so battery discharge and hub allocation have the strongest effect during expensive hours.</li>
          <li><b>The reported HMARL result</b> reduces the average household bill from ₹169.98/day to ₹133.02/day, a 21.7% reduction, while hub utilisation reaches 67.2%.</li>
        </ul>
      </div>
    </section>
  );
}

function MiniChart({
  data,
  getValue,
  color,
  label,
}: {
  data: StepSnapshot[];
  getValue: (step: StepSnapshot) => number;
  color: string;
  label: string;
}) {
  const points = data.map(getValue);
  const max = Math.max(...points, 1);
  const path = points
    .map((point, index) => {
      const x = (index / Math.max(1, points.length - 1)) * 100;
      const y = 34 - (point / max) * 30;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");

  return (
    <div className="mini-chart">
      <span>{label}</span>
      <svg viewBox="0 0 100 38" role="img" aria-label={label}>
        <path d={path} fill="none" stroke={color} strokeWidth="2.5" />
      </svg>
    </div>
  );
}

function DigitalTwinScene({
  step,
  config,
}: {
  step: StepSnapshot;
  config: Config;
}) {
  const prosumers = step.homes.filter((home) => home.type === "prosumer");
  const consumers = step.homes.filter((home) => home.type === "consumer");
  const rowPositions = [18, 40, 62, 82];
  const prosumerPositions = prosumers.map((home, index) => ({
    home,
    top: rowPositions[index % rowPositions.length],
    left: index < 4 ? 8 : 23,
  }));
  const consumerPositions = consumers.map((home, index) => ({
    home,
    top: rowPositions[index % rowPositions.length],
    left: index < 4 ? 76 : 89,
  }));

  return (
    <section className="scene-shell" aria-label="Animated HMARL smart grid simulator">
      <div className="scene-toolbar">
        <div>
          <span>24-hour replay</span>
          <strong>
            {String(Math.floor(step.hour)).padStart(2, "0")}:
            {step.hour % 1 === 0 ? "00" : step.hour % 1 === 0.25 ? "15" : step.hour % 1 === 0.5 ? "30" : "45"}
          </strong>
        </div>
        <div>
          <span>Pricing signal</span>
          <strong>₹{step.price.toFixed(2)}/kWh</strong>
        </div>
        <div>
          <span>Hub policy</span>
          <strong>{STRATEGY_LABEL[config.strategy]}</strong>
        </div>
      </div>

      <div className="energy-stage">
        <div className="grid-plane" />
        <svg className="flow-lines" viewBox="0 0 100 100" preserveAspectRatio="none">
          {prosumerPositions.map(({ home, top, left }) => (
            <path
              key={`p-${home.id}`}
              className={`flow-line ${home.hubInjection > 0.05 ? "active" : ""}`}
              d={`M ${left + 4} ${top + 4} C 35 ${top} 42 48 50 50`}
            />
          ))}
          {consumerPositions.map(({ home, top, left }) => (
            <path
              key={`c-${home.id}`}
              className={`flow-line consumer ${home.hubAllocation > 0.05 ? "active" : ""}`}
              d={`M 50 50 C 60 48 66 ${top} ${left - 2} ${top + 4}`}
            />
          ))}
          <path
            className={`flow-line grid ${step.gridImport > 0.2 || step.gridExport > 0.2 ? "active" : ""}`}
            d="M 50 55 C 49 70 50 80 50 92"
          />
        </svg>

        <div className="hub-node">
          <div className="hub-building">
            <span />
            <span />
            <span />
          </div>
          <strong>Central Hub</strong>
          <small>{round(step.totalHubAllocation)} kW allocated</small>
        </div>

        <div className="grid-node">
          <div className="tower">
            <span />
          </div>
          <strong>Grid</strong>
          <small>{round(step.gridImport)} kW import</small>
        </div>

        {prosumerPositions.map(({ home, top, left }) => (
          <div
            className={`home-node prosumer ${home.action.toLowerCase()}`}
            key={home.id}
            style={{ top: `${top}%`, left: `${left}%` }}
          >
            <div className="roof" />
            <div className="house-body">
              <span className="solar-panel" />
              <span className="battery">{Math.round(home.soc * 100)}%</span>
            </div>
            <div className="node-caption">
              <strong>{home.label}</strong>
              <small>{ACTION_LABEL[home.action]}</small>
            </div>
          </div>
        ))}

        {consumerPositions.map(({ home, top, left }) => (
          <div
            className="home-node consumer"
            key={home.id}
            style={{ top: `${top}%`, left: `${left}%` }}
          >
            <div className="roof" />
            <div className="house-body consumer-house" />
            <div className="node-caption">
              <strong>{home.label}</strong>
              <small>{round(home.hubAllocation)} kW</small>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function Home() {
  const [config, setConfig] = useState<Config>(DEFAULT_CONFIG);
  const [stepIndex, setStepIndex] = useState(DEFAULT_STEP_INDEX);
  const [running, setRunning] = useState(true);

  const simulation = useMemo(() => buildSimulation(config), [config]);
  const currentStep = simulation.steps[stepIndex] ?? simulation.steps[0];

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => {
      setStepIndex((index) => (index + 1) % 96);
    }, 850);
    return () => window.clearInterval(timer);
  }, [running]);

  useEffect(() => {
    setStepIndex((index) => clamp(index, 0, simulation.steps.length - 1));
  }, [simulation.steps.length]);

  const setConfigValue = <K extends keyof Config>(key: K, value: Config[K]) => {
    setConfig((previous) => ({ ...previous, [key]: value }));
  };

  const resetToDefault = () => {
    setConfig({ ...DEFAULT_CONFIG });
    setStepIndex(DEFAULT_STEP_INDEX);
    setRunning(true);
  };

  return (
    <main className="app-shell">
      <SiteNav />
      <section className="hero-section">
        <div className="hero-copy">
          <p className="eyebrow">HMARL Smart Grid Simulator</p>
          <h1>Forecast-driven multi-agent simulation for community energy optimisation.</h1>
          <p>
            A deployable 24-hour simulator based on the research paper:
            appliance scheduling, independent DQN prosumer agents, Central Hub
            redistribution, ToU pricing, and PV forecasting.
          </p>
          <div className="hero-actions">
            <button className="primary-action" onClick={() => setRunning((value) => !value)}>
              {running ? "Pause simulation" : "Run simulation"}
            </button>
            <button
              className="ghost-action"
              onClick={() =>
                setConfig((previous) => ({
                  ...previous,
                  strategy:
                    previous.strategy === "demand-first"
                      ? "consumer-priority"
                      : previous.strategy === "consumer-priority"
                        ? "prosumer-priority"
                        : "demand-first",
                }))
              }
            >
              Switch policy
            </button>
            <Link className="icon-action" href="/technical">
              View formulas
            </Link>
          </div>
        </div>

        <div className="hero-panel">
          <MetricCard
            label="Bill reduction"
            value={round(simulation.summary.billReduction, 1).toString()}
            unit="%"
            tone="green"
          />
          <MetricCard
            label="Avg bill"
            value={`₹${round(simulation.summary.avgBill, 2)}`}
            tone="blue"
          />
          <MetricCard
            label="PV utilisation"
            value={round(simulation.summary.pvUtilisation, 1).toString()}
            unit="%"
            tone="amber"
          />
          <MetricCard
            label="Hub utilisation"
            value={round(simulation.summary.hubUtilisation, 1).toString()}
            unit="%"
            tone="green"
          />
        </div>
      </section>

      <section className="route-grid" aria-label="Technical project pages">
        {ROUTES.map((route) => (
          <Link className="route-card" href={route.href} key={route.href}>
            <span>{route.icon}</span>
            <div>
              <h3>{route.title}</h3>
              <p>{route.body}</p>
            </div>
          </Link>
        ))}
      </section>

      <section className="workspace-grid">
        <aside className="control-panel">
          <div className="panel-heading">
            <span>Interactive controls</span>
            <strong>{config.prosumers + config.consumers} homes</strong>
          </div>
          <button
            type="button"
            className="reset-default"
            onClick={resetToDefault}
            title="Restore the paper default: 7 prosumers, 8 consumers, Demand-First allocation, normal PV/load, 11 kWh battery, and original pricing."
          >
            Set to default
          </button>

          <div className="segmented-control" role="group" aria-label="Hub allocation strategy">
            {(Object.keys(STRATEGY_LABEL) as AllocationStrategy[]).map((strategy) => (
              <button
                key={strategy}
                className={config.strategy === strategy ? "active" : ""}
                title={STRATEGY_HELP[strategy]}
                onClick={() => setConfigValue("strategy", strategy)}
              >
                {STRATEGY_LABEL[strategy]}
              </button>
            ))}
          </div>

          <Slider
            label="Prosumer homes"
            value={config.prosumers}
            min={2}
            max={12}
            step={1}
            help={CONTROL_HELP.prosumers}
            onChange={(value) => setConfigValue("prosumers", value)}
          />
          <Slider
            label="Consumer homes"
            value={config.consumers}
            min={2}
            max={18}
            step={1}
            help={CONTROL_HELP.consumers}
            onChange={(value) => setConfigValue("consumers", value)}
          />
          <Slider
            label="PV intensity"
            value={config.pvScale}
            min={0.45}
            max={1.65}
            step={0.05}
            suffix="x"
            help={CONTROL_HELP.pvScale}
            onChange={(value) => setConfigValue("pvScale", value)}
          />
          <Slider
            label="Load pressure"
            value={config.loadScale}
            min={0.65}
            max={1.6}
            step={0.05}
            suffix="x"
            help={CONTROL_HELP.loadScale}
            onChange={(value) => setConfigValue("loadScale", value)}
          />
          <Slider
            label="Battery capacity"
            value={config.batteryCapacity}
            min={8}
            max={15}
            step={0.5}
            suffix=" kWh"
            help={CONTROL_HELP.batteryCapacity}
            onChange={(value) => setConfigValue("batteryCapacity", value)}
          />
          <Slider
            label="Peak price"
            value={config.peakPrice}
            min={7}
            max={14}
            step={0.5}
            suffix=" ₹/kWh"
            help={CONTROL_HELP.peakPrice}
            onChange={(value) => setConfigValue("peakPrice", value)}
          />

          <label className="timeline-control" title={CONTROL_HELP.timeline.help}>
            <span>
              Manual timeline
            </span>
            <input
              type="range"
              min={0}
              max={95}
              value={stepIndex}
              onChange={(event) => {
                setRunning(false);
                setStepIndex(Number(event.target.value));
              }}
            />
            <small className="control-explain">
              <b>Forward:</b> {CONTROL_HELP.timeline.up}
              <br />
              <b>Backward:</b> {CONTROL_HELP.timeline.down}
            </small>
          </label>
        </aside>

        <div className="main-experience">
          <DigitalTwinScene step={currentStep} config={config} />

          <section className="analytics-grid">
            <MetricCard label="Peak demand" value={round(simulation.summary.peakDemand).toString()} unit=" kW" />
            <MetricCard label="Prosumer revenue" value={`₹${round(simulation.summary.prosumerRevenue, 2)}`} tone="green" />
            <MetricCard label="Grid dependency" value={round(simulation.summary.gridDependency, 1).toString()} unit="%" tone="red" />
            <MetricCard label="Community reward" value={round(currentStep.reward, 2).toString()} tone="amber" />
          </section>

          <section className="charts-row">
            <MiniChart
              data={simulation.steps}
              label="PV generation"
              getValue={(step) => step.totalPv}
              color="#2f6f5e"
            />
            <MiniChart
              data={simulation.steps}
              label="Grid import"
              getValue={(step) => step.gridImport}
              color="#496f86"
            />
            <MiniChart
              data={simulation.steps}
              label="Hub allocation"
              getValue={(step) => step.totalHubAllocation}
              color="#a56d2e"
            />
            <MiniChart
              data={simulation.steps}
              label="Average SoC"
              getValue={(step) => step.avgSoc * 100}
              color="#756f9f"
            />
          </section>
        </div>
      </section>

      <section className="paper-section">
        <div className="paper-copy">
          <p className="eyebrow">Paper-grounded architecture</p>
          <h2>Three-layer HMARL system preserved from the report.</h2>
          <p>
            Layer 1 schedules appliances with price-aware greedy logic. Layer 2
            uses prosumer DQN-style battery decisions over charge, discharge,
            and idle actions. Layer 3 redistributes surplus PV through the
            Central Hub using the three allocation strategies in the paper.
          </p>
        </div>
        <img
          src="/research-assets/system_architecture.png"
          alt="Proposed HMARL architecture for energy management in smart communities"
        />
      </section>

      <DefaultSetupSection />

      <AssumptionsSection />

      <section className="results-section">
        <div className="section-heading">
          <p className="eyebrow">Research results</p>
          <h2>Original paper outputs included for reproducibility.</h2>
        </div>
        <div className="result-gallery">
          <img src="/research-assets/scenario_metrics.png" alt="Scenario comparison key metrics" />
          <img src="/research-assets/dqn_training_progress.png" alt="DQN training progress" />
          <img src="/research-assets/pv_utilisation_breakdown.png" alt="PV utilisation breakdown" />
          <img src="/research-assets/hub_allocation.png" alt="Hub allocation strategy comparison" />
        </div>
      </section>
    </main>
  );
}
