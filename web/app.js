const app = document.getElementById("app");

const DEFAULT_CONFIG = {
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
const config = { ...DEFAULT_CONFIG };

let running = true;
let stepIndex = DEFAULT_STEP_INDEX;
let timer = null;
let motionTimer = null;
let loadingTimer = null;

const STRATEGY_LABEL = {
  "demand-first": "Demand-First",
  "consumer-priority": "Consumer-Priority",
  "prosumer-priority": "Prosumer-Priority",
};

const STRATEGY_HELP = {
  "demand-first": "Allocates hub energy in proportion to each consumer's instantaneous demand. This is the balanced policy.",
  "consumer-priority": "Serves consumers first up to their unmet demand. This usually improves consumer fairness and lowers grid import.",
  "prosumer-priority": "Lets prosumers retain more surplus before sharing. This usually increases prosumer incentive and revenue.",
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

const METRIC_HELP = {
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
    detail: "The simulation follows the report setup: 96 time steps, each representing 15 minutes. This lets the viewer see night, morning demand, solar noon, evening peak, and late-night recovery.",
  },
  {
    title: "Default community size",
    detail: "The paper starts with 15 homes: 7 prosumers and 8 consumers. The simulator keeps that as the default but allows the counts to change for what-if analysis.",
  },
  {
    title: "PV generation and forecasting",
    detail: "The local runner uses a deterministic daylight PV curve as replaceable synthetic forecast data. In the paper, the forecasting module is Extra Trees using weather and time features.",
  },
  {
    title: "Dynamic pricing",
    detail: "A time-of-use tariff is used: ₹5/kWh off-peak and ₹9.5/kWh from 11:00 to 23:00. This creates an incentive to charge/store when energy is cheap or abundant and discharge/share when value is high.",
  },
  {
    title: "Battery constraints",
    detail: "Prosumer batteries follow the report constraints: 8-15 kWh capacity range, 2.5 kW maximum battery power, and SoC bounded between 10% and 90%.",
  },
  {
    title: "Price-aware appliance scheduling",
    detail: "Flexible appliances are shifted toward low-price windows before the battery policy runs. This matches Layer 1 of the HMARL architecture.",
  },
  {
    title: "DQN-style battery policy",
    detail: "The browser simulator represents the trained DQN behavior with a deterministic policy over the same state and action space. This keeps the demo fast while preserving the paper's decision logic.",
  },
  {
    title: "Central Hub redistribution",
    detail: "The hub collects surplus from prosumers and reallocates it using Demand-First, Consumer-Priority, or Prosumer-Priority. These match the three strategies in the report.",
  },
  {
    title: "Synthetic database boundary",
    detail: "Home demand, PV capacity, flexible appliances, and initial SoC are generated deterministically. The API contract can later be replaced by CSV, SQL, or smart-meter data.",
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

const GUIDE_NAV = [
  ["story", "Simple Story"],
  ["problem", "Problem"],
  ["terms", "Terms"],
  ["architecture", "Architecture"],
  ["simulation", "Simulation"],
  ["learning", "How AI Learns"],
  ["hub", "Hub Policies"],
  ["results", "Results"],
  ["read-simulator", "Using The Simulator"],
];

const GUIDE_TERMS = [
  ["Smart grid", "An electricity network that can sense, communicate, and make better decisions instead of only sending power one way."],
  ["PV", "Photovoltaic solar generation. In simple words, rooftop solar power."],
  ["Prosumer", "A house that produces and consumes electricity. It has PV panels and battery storage."],
  ["Consumer", "A house that only consumes electricity and depends on the hub or grid for supply."],
  ["Battery SoC", "State of Charge. It is the battery's fuel-gauge percentage, bounded in the paper between 10% and 90%."],
  ["Dynamic pricing", "Electricity price changes with time. The simulator uses peak and off-peak prices in rupees."],
  ["Demand response", "Shifting flexible electricity use to a better time, like running a washing machine when energy is cheaper."],
  ["MARL", "Multi-Agent Reinforcement Learning. Many small AI decision-makers learn in the same environment."],
  ["DQN", "Deep Q-Network. A neural network that scores actions such as charge, discharge, or idle."],
  ["Central Hub", "The community energy coordinator that collects surplus PV from prosumers and allocates it to consumers."],
  ["Curtailment", "Solar energy that is not used immediately. In this paper, some lower PV utilisation is strategic, not automatically bad."],
  ["Grid import", "Electricity bought from the external grid when local PV, battery, and hub energy are not enough."],
];

const GUIDE_SETUP = [
  ["Community", "15 households: 7 prosumers and 8 consumers."],
  ["Time horizon", "24 hours split into 96 steps, each step lasting 15 minutes."],
  ["PV ratings", "Prosumer PV systems vary from 2 to 6 kW."],
  ["Battery range", "Batteries vary from 8 to 15 kWh with 2.5 kW maximum power."],
  ["Pricing", "Peak price from 11:00 to 23:00; off-peak outside that window."],
  ["Training", "300 episodes with replay buffer, target network, epsilon decay, and DQN updates."],
];

const GUIDE_SCENARIOS = [
  ["Conventional", "No Central Hub, no appliance scheduling, and a fixed battery rule. This is the uncoordinated baseline."],
  ["Agent-Based baseline", "A prior DQN-style baseline is used for comparison, but it does not include the full three-layer community coordination."],
  ["HMARL Demand-First", "Hub energy is allocated in proportion to consumer demand. This is the balanced default policy."],
  ["HMARL Consumer-Priority", "Consumers receive shared energy first, reducing their grid import pressure."],
  ["HMARL Prosumer-Priority", "Prosumers retain more surplus value first, strengthening the incentive to invest in PV and storage."],
];

const navLinks = [
  ["/", "SG", "Simulator"],
  ["/guide", "PG", "Paper Guide"],
  ["/technical", "FX", "Formulas"],
  ["/algorithm", "DQ", "Algorithm"],
  ["/implementation", "FS", "Implementation"],
  ["/results", "RV", "Results"],
];

const round = (value, digits = 2) =>
  Number.isFinite(value) ? Number(value.toFixed(digits)) : 0;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function seededWave(seed, offset = 0) {
  const raw = Math.sin(seed * 12.9898 + offset * 78.233) * 43758.5453;
  return raw - Math.floor(raw);
}

function priceAtHour(hour) {
  return hour >= 11 && hour < 23 ? config.peakPrice : config.offPeakPrice;
}

function solarCurve(hour) {
  if (hour < 5.5 || hour > 19) return 0;
  const daylight = (hour - 5.5) / 13.5;
  return Math.pow(Math.sin(Math.PI * daylight), 1.35);
}

function demandCurve(hour, homeIndex) {
  const morning = Math.exp(-Math.pow((hour - 7.5) / 2.1, 2));
  const evening = Math.exp(-Math.pow((hour - 20) / 2.5, 2));
  const noon = Math.exp(-Math.pow((hour - 13) / 4.4, 2)) * 0.35;
  const householdBias = 0.78 + seededWave(homeIndex, 4) * 0.48;
  return householdBias * (0.5 + morning * 0.7 + evening * 0.95 + noon);
}

function applianceLoad(hour, homeIndex) {
  const hasWasher = homeIndex % 3 === 0;
  const hasGeyser = homeIndex % 2 === 0;
  const hasCooker = homeIndex % 4 === 1;
  let load = 0;
  if (hasWasher && hour >= 8 && hour < 10 && priceAtHour(hour) === config.offPeakPrice) load += 0.65;
  if (hasGeyser && hour >= 6 && hour < 8.5) load += 0.55;
  if (hasCooker && hour >= 18 && hour < 19.5) load += 0.45;
  return load;
}

function qPolicy(soc, forecastPv, load, price, hour) {
  const priceNorm = (price - config.offPeakPrice) / Math.max(0.001, config.peakPrice - config.offPeakPrice);
  const pvSurplus = forecastPv - load;
  const timeNorm = hour / 24;
  const scores = {
    CHARGE:
      soc >= 0.88
        ? -999
        : (1 - priceNorm) * 1.8 + Math.max(0, pvSurplus) * 0.42 + (0.9 - soc) * 1.7 - Math.max(0, timeNorm - 0.7) * 0.7,
    DISCHARGE:
      soc <= 0.14
        ? -999
        : priceNorm * 2.2 + Math.max(0, load - forecastPv) * 0.5 + (soc - 0.1) * 1.45 - Math.max(0, forecastPv - load) * 0.25,
    IDLE: 0.62 - Math.abs(soc - 0.55) * 0.25 - Math.abs(pvSurplus) * 0.03,
  };
  return Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0];
}

function applyHubAllocation(homes, hubEnergy) {
  const consumers = homes.filter((home) => home.type === "consumer");
  const consumerNeed = consumers.reduce((sum, home) => sum + home.gridImport, 0);
  const totalDemand = consumers.reduce((sum, home) => sum + home.load, 0);
  if (hubEnergy <= 0 || consumerNeed <= 0) return homes;

  if (config.strategy === "demand-first") {
    homes.forEach((home) => {
      if (home.type !== "consumer") return;
      const share = totalDemand > 0 ? home.load / totalDemand : 0;
      const allocation = Math.min(home.gridImport, hubEnergy * share);
      home.hubAllocation = allocation;
      home.gridImport = Math.max(0, home.gridImport - allocation);
    });
    return homes;
  }

  let remaining = config.strategy === "prosumer-priority" ? hubEnergy * 0.72 : hubEnergy;
  homes
    .filter((home) => home.type === "consumer")
    .sort((a, b) => b.load - a.load)
    .forEach((home) => {
      const allocation =
        config.strategy === "consumer-priority"
          ? Math.min(home.gridImport, remaining)
          : Math.min(home.gridImport, remaining / Math.max(1, consumers.length));
      home.hubAllocation = allocation;
      home.gridImport = Math.max(0, home.gridImport - allocation);
      remaining -= allocation;
    });
  return homes;
}

function rewardForHome(home, price, pvCurtailed) {
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
}

function buildSimulation() {
  const totalHomes = config.prosumers + config.consumers;
  const soc = Array.from({ length: config.prosumers }, (_, index) => 0.22 + seededWave(index + 1, 7) * 0.55);
  const steps = [];
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
    const price = priceAtHour(hour);
    const homes = [];

    for (let i = 0; i < totalHomes; i += 1) {
      const isProsumer = i < config.prosumers;
      const baseLoad = (0.8 + seededWave(i + 1, 1) * 1.25) * config.loadScale;
      const load = Math.max(0.2, baseLoad * demandCurve(hour, i + 1) + applianceLoad(hour, i));
      const pvCapacity = (2 + seededWave(i + 1, 2) * 4) * config.pvScale;
      const pv = isProsumer ? pvCapacity * solarCurve(hour) * (0.92 + seededWave(step + 1, i + 3) * 0.16) : 0;
      const forecastPv = isProsumer ? Math.max(0, pv * (0.96 + Math.sin((step + i) * 0.23) * 0.06)) : 0;
      const home = {
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
        const action = qPolicy(home.soc, forecastPv, load, price, hour);
        home.action = action;
        let batteryPower = 0;
        if (action === "CHARGE") {
          batteryPower = Math.min(2.5, ((0.9 - soc[i]) * config.batteryCapacity) / 0.25);
          soc[i] = clamp(soc[i] + (0.95 * batteryPower * 0.25) / config.batteryCapacity, 0.1, 0.9);
        } else if (action === "DISCHARGE") {
          batteryPower = -Math.min(2.5, ((soc[i] - 0.1) * config.batteryCapacity * 0.9) / 0.25);
          soc[i] = clamp(soc[i] - (Math.abs(batteryPower) * 0.25) / (0.9 * config.batteryCapacity), 0.1, 0.9);
        }
        const servedByBattery = Math.max(0, -batteryPower);
        const surplus = Math.max(0, pv - load - Math.max(0, batteryPower));
        home.hubInjection =
          config.strategy === "prosumer-priority"
            ? Math.max(0, pv - load - Math.max(0, batteryPower) - 0.25 * 2.5)
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
    applyHubAllocation(homes, hubEnergy);
    const totalPv = homes.reduce((sum, home) => sum + home.pv, 0);
    const totalLoad = homes.reduce((sum, home) => sum + home.load, 0);
    const totalHubInjection = homes.reduce((sum, home) => sum + home.hubInjection, 0);
    const totalHubAllocation = homes.reduce((sum, home) => sum + home.hubAllocation, 0);
    const gridImport = homes.reduce((sum, home) => sum + home.gridImport, 0);
    const gridExport = homes.reduce((sum, home) => sum + home.gridExport, 0);
    const pvCurtailed = Math.max(0, totalPv - totalLoad - totalHubInjection - gridExport);
    homes.forEach((home) => {
      home.reward = rewardForHome(home, price, pvCurtailed / Math.max(1, config.prosumers));
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
          ? homes.filter((home) => home.type === "prosumer").reduce((sum, home) => sum + home.soc, 0) / config.prosumers
          : 0,
      avgBill: cumulativeBill / Math.max(1, totalHomes),
      revenue: cumulativeRevenue,
      pvUtilisation: cumulativePv > 0 ? clamp((cumulativePvUsed / cumulativePv) * 100, 0, 100) : 0,
      hubUtilisation: cumulativeHubIn > 0 ? clamp((cumulativeHubOut / cumulativeHubIn) * 100, 0, 100) : 0,
      reward: homes.reduce((sum, home) => sum + home.reward, 0),
      homes,
    });
  }

  const avgBill = cumulativeBill / Math.max(1, totalHomes);
  const conventionalAvg = conventionalBill / Math.max(1, totalHomes);
  return {
    steps,
    summary: {
      avgBill,
      conventionalBill: conventionalAvg,
      billReduction: conventionalAvg > 0 ? clamp(((conventionalAvg - avgBill) / conventionalAvg) * 100, -100, 100) : 0,
      prosumerRevenue: cumulativeRevenue,
      peakDemand,
      pvUtilisation: cumulativePv > 0 ? clamp((cumulativePvUsed / cumulativePv) * 100, 0, 100) : 0,
      hubUtilisation: cumulativeHubIn > 0 ? clamp((cumulativeHubOut / cumulativeHubIn) * 100, 0, 100) : 0,
      gridDependency: cumulativeGridImport > 0 ? clamp((cumulativeGridImport / Math.max(1, peakDemand * 24)) * 100, 0, 100) : 0,
    },
  };
}

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem("hmarl-theme", theme);
}

function nav() {
  const current = window.location.pathname;
  return `
    <nav class="top-nav" aria-label="Project navigation">
      <a class="brand" href="/"><span class="brand-mark">H</span><span>HMARL Smart Grid</span></a>
      <div class="nav-links">
        ${navLinks
          .map(
            ([href, icon, label]) =>
              `<a class="${current === href ? "active-link" : ""}" href="${href}"><span>${icon}</span>${label}</a>`,
          )
          .join("")}
        <button type="button" data-theme-toggle>${document.documentElement.dataset.theme === "light" ? "Dark" : "Light"}</button>
      </div>
    </nav>
  `;
}

function playPageMotion(withLoader = false) {
  clearTimeout(motionTimer);
  clearTimeout(loadingTimer);
  document.body.classList.add("motion-intro");
  if (withLoader) document.body.classList.add("route-loading");
  motionTimer = setTimeout(() => document.body.classList.remove("motion-intro"), 760);
  loadingTimer = setTimeout(() => document.body.classList.remove("route-loading"), 520);
}

function metric(label, value, unit = "", tone = "blue") {
  const help = METRIC_HELP[label] || "Simulator metric derived from the current 24-hour scenario.";
  return `<div class="metric-card ${tone}" title="${help}"><span>${label}</span><strong>${value}${unit ? `<small>${unit}</small>` : ""}</strong></div>`;
}

function slider(label, key, min, max, step, suffix = "") {
  const value = config[key];
  const hint = CONTROL_HELP[key];
  return `
    <label class="control-row" title="${hint.help}">
      <span>${label}<strong>${round(value, step < 1 ? 2 : 0)}${suffix}</strong></span>
      <input type="range" min="${min}" max="${max}" step="${step}" value="${value}" data-config="${key}" />
      <small class="control-explain"><b>Increase:</b> ${hint.up}<br><b>Decrease:</b> ${hint.down}</small>
    </label>
  `;
}

function defaultSetupSection() {
  return `
    <section class="default-section" id="paper-default">
      <div class="section-heading">
        <div>
          <p class="eyebrow">Paper default setup</p>
          <h2>What the reset button restores, and why it matters.</h2>
        </div>
      </div>
      <p class="assumption-intro">The default state follows the report simulation setup. It gives the viewer a reproducible baseline before changing PV, load, battery size, price, or Central Hub strategy.</p>
      <div class="default-grid">
        ${PAPER_DEFAULT_SETUP.map((item) => `<article class="default-card"><span>${item.value}</span><h3>${item.title}</h3><p>${item.detail}</p></article>`).join("")}
      </div>
      <div class="scenario-grid">
        ${PAPER_SCENARIOS.map((item) => `<article class="scenario-card"><h3>${item.title}</h3><p>${item.detail}</p></article>`).join("")}
      </div>
      <div class="reasoning-panel">
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
  `;
}

function assumptionsSection() {
  return `
    <section class="assumptions-section" id="assumptions">
      <div class="section-heading">
        <div>
          <p class="eyebrow">Standard assumptions</p>
          <h2>How to read the simulator.</h2>
        </div>
      </div>
      <p class="assumption-intro">These assumptions keep the website aligned with the research paper while making the model understandable to someone opening it for the first time.</p>
      <div class="assumption-grid">
        ${MODEL_ASSUMPTIONS.map((item) => `<article class="assumption-card"><h3>${item.title}</h3><p>${item.detail}</p></article>`).join("")}
      </div>
      <div class="reasoning-panel">
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
  `;
}

function formatTime(hour) {
  const h = Math.floor(hour).toString().padStart(2, "0");
  const minutes = Math.round((hour % 1) * 60).toString().padStart(2, "0");
  return `${h}:${minutes}`;
}

function miniChart(data, key, label, color, scale = 1) {
  const points = data.map((step) => step[key] * scale);
  const max = Math.max(...points, 1);
  const path = points
    .map((point, index) => {
      const x = (index / Math.max(1, points.length - 1)) * 100;
      const y = 34 - (point / max) * 30;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
  return `
    <div class="mini-chart">
      <span>${label}</span>
      <svg viewBox="0 0 100 38" role="img" aria-label="${label}">
        <path d="${path}" fill="none" stroke="${color}" stroke-width="2.5"></path>
      </svg>
    </div>
  `;
}

function scene(step) {
  const prosumers = step.homes.filter((home) => home.type === "prosumer");
  const consumers = step.homes.filter((home) => home.type === "consumer");
  const rowPositions = [18, 40, 62, 82];
  const pPositions = prosumers.map((home, index) => ({ home, top: rowPositions[index % rowPositions.length], left: index < 4 ? 8 : 23 }));
  const cPositions = consumers.map((home, index) => ({ home, top: rowPositions[index % rowPositions.length], left: index < 4 ? 76 : 89 }));

  return `
    <section class="scene-shell" aria-label="Animated HMARL smart grid simulator">
      <div class="scene-toolbar">
        <div><span>24-hour replay</span><strong>${formatTime(step.hour)}</strong></div>
        <div><span>Pricing signal</span><strong>₹${step.price.toFixed(2)}/kWh</strong></div>
        <div><span>Hub policy</span><strong>${STRATEGY_LABEL[config.strategy]}</strong></div>
      </div>
      <div class="energy-stage">
        <div class="grid-plane"></div>
        <svg class="flow-lines" viewBox="0 0 100 100" preserveAspectRatio="none">
          ${pPositions
            .map(
              ({ home, top, left }) =>
                `<path class="flow-line ${home.hubInjection > 0.05 ? "active" : ""}" d="M ${left + 4} ${top + 4} C 35 ${top} 42 48 50 50"></path>`,
            )
            .join("")}
          ${cPositions
            .map(
              ({ home, top, left }) =>
                `<path class="flow-line consumer ${home.hubAllocation > 0.05 ? "active" : ""}" d="M 50 50 C 60 48 66 ${top} ${left - 2} ${top + 4}"></path>`,
            )
            .join("")}
          <path class="flow-line grid ${step.gridImport > 0.2 || step.gridExport > 0.2 ? "active" : ""}" d="M 50 55 C 49 70 50 80 50 92"></path>
        </svg>
        <div class="hub-node">
          <div class="hub-building"><span></span><span></span><span></span></div>
          <strong>Central Hub</strong><small>${round(step.totalHubAllocation)} kW allocated</small>
        </div>
        <div class="grid-node"><div class="tower"><span></span></div><strong>Grid</strong><small>${round(step.gridImport)} kW import</small></div>
        ${pPositions
          .map(
            ({ home, top, left }) => `
              <div class="home-node prosumer ${home.action.toLowerCase()}" style="top:${top}%;left:${left}%">
                <div class="roof"></div><div class="house-body"><span class="solar-panel"></span><span class="battery">${Math.round(home.soc * 100)}%</span></div>
                <div class="node-caption"><strong>${home.label}</strong><small>${home.action}</small></div>
              </div>`,
          )
          .join("")}
        ${cPositions
          .map(
            ({ home, top, left }) => `
              <div class="home-node consumer" style="top:${top}%;left:${left}%">
                <div class="roof"></div><div class="house-body consumer-house"></div>
                <div class="node-caption"><strong>${home.label}</strong><small>${round(home.hubAllocation)} kW</small></div>
              </div>`,
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderSimulator() {
  const simulation = buildSimulation();
  const current = simulation.steps[stepIndex] || simulation.steps[0];
  app.innerHTML = `
    ${nav()}
    <section class="hero-section">
      <div class="hero-copy">
        <p class="eyebrow">HMARL Smart Grid Simulator</p>
        <h1>Forecast-driven multi-agent simulation for community energy optimisation.</h1>
        <p>A deployable 24-hour simulator based on the research paper: appliance scheduling, independent DQN prosumer agents, Central Hub redistribution, ToU pricing, and PV forecasting.</p>
        <div class="hero-actions">
          <button class="primary-action" data-run>${running ? "Pause simulation" : "Run simulation"}</button>
          <button class="ghost-action" data-switch>Switch policy</button>
          <a class="icon-action" href="/technical">View formulas</a>
        </div>
      </div>
      <div class="hero-panel">
        ${metric("Bill reduction", round(simulation.summary.billReduction, 1), "%", "green")}
        ${metric("Avg bill", `₹${round(simulation.summary.avgBill, 2)}`)}
        ${metric("PV utilisation", round(simulation.summary.pvUtilisation, 1), "%", "amber")}
        ${metric("Hub utilisation", round(simulation.summary.hubUtilisation, 1), "%", "green")}
      </div>
    </section>
    <section class="route-grid" aria-label="Technical project pages">
      ${[
        ["/guide", "PG", "Paper Guide", "Layman's explanation, analogies, glossary, simulation setup, and result interpretation."],
        ["/technical", "FX", "Technical Formulations", "Energy balance, SoC update, ToU pricing, state/action/reward equations."],
        ["/algorithm", "DQ", "HMARL Algorithm", "Appliance scheduling, DQN action selection, replay buffer, target network."],
        ["/implementation", "FS", "Full-Stack Build", "Synthetic data layer, simulator engine, replaceable datasets, scalable UI."],
        ["/results", "RV", "Research Results", "Paper metrics, DQN convergence, hub allocation, PV utilisation figures."],
      ]
        .map(([href, icon, title, body]) => `<a class="route-card" href="${href}"><span>${icon}</span><div><h3>${title}</h3><p>${body}</p></div></a>`)
        .join("")}
    </section>
    <section class="workspace-grid">
      <aside class="control-panel">
        <div class="panel-heading"><span>Interactive controls</span><strong>${config.prosumers + config.consumers} homes</strong></div>
        <button class="reset-default" type="button" data-default title="Restore the paper default: 7 prosumers, 8 consumers, Demand-First allocation, normal PV/load, 11 kWh battery, and original pricing.">Set to default</button>
        <div class="segmented-control">
          ${Object.entries(STRATEGY_LABEL)
            .map(([key, label]) => `<button class="${config.strategy === key ? "active" : ""}" data-strategy="${key}" title="${STRATEGY_HELP[key]}">${label}</button>`)
            .join("")}
        </div>
        ${slider("Prosumer homes", "prosumers", 2, 12, 1)}
        ${slider("Consumer homes", "consumers", 2, 18, 1)}
        ${slider("PV intensity", "pvScale", 0.45, 1.65, 0.05, "x")}
        ${slider("Load pressure", "loadScale", 0.65, 1.6, 0.05, "x")}
        ${slider("Battery capacity", "batteryCapacity", 8, 15, 0.5, " kWh")}
        ${slider("Peak price", "peakPrice", 7, 14, 0.5, " ₹/kWh")}
        <label class="timeline-control" title="${CONTROL_HELP.timeline.help}"><span>Manual timeline</span><input type="range" min="0" max="95" value="${stepIndex}" data-step /><small class="control-explain"><b>Forward:</b> ${CONTROL_HELP.timeline.up}<br><b>Backward:</b> ${CONTROL_HELP.timeline.down}</small></label>
      </aside>
      <div class="main-experience">
        ${scene(current)}
        <section class="analytics-grid">
          ${metric("Peak demand", round(simulation.summary.peakDemand), " kW")}
          ${metric("Prosumer revenue", `₹${round(simulation.summary.prosumerRevenue, 2)}`, "", "green")}
          ${metric("Grid dependency", round(simulation.summary.gridDependency, 1), "%", "red")}
          ${metric("Community reward", round(current.reward, 2), "", "amber")}
        </section>
        <section class="charts-row">
          ${miniChart(simulation.steps, "totalPv", "PV generation", "#2f6f5e")}
          ${miniChart(simulation.steps, "gridImport", "Grid import", "#496f86")}
          ${miniChart(simulation.steps, "totalHubAllocation", "Hub allocation", "#a56d2e")}
          ${miniChart(simulation.steps, "avgSoc", "Average SoC", "#756f9f", 100)}
        </section>
      </div>
    </section>
    <section class="paper-section">
      <div class="paper-copy"><p class="eyebrow">Paper-grounded architecture</p><h2>Three-layer HMARL system preserved from the report.</h2><p>Layer 1 schedules appliances with price-aware greedy logic. Layer 2 uses prosumer DQN-style battery decisions. Layer 3 redistributes surplus PV through the Central Hub.</p></div>
      <img src="/public/research-assets/system_architecture.png" alt="Proposed HMARL architecture">
    </section>
    ${defaultSetupSection()}
    ${assumptionsSection()}
  `;
  bindSimulatorEvents();
}

function bindSharedEvents() {
  document.querySelector("[data-theme-toggle]")?.addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    setTheme(next);
    render();
  });
}

function bindSimulatorEvents() {
  bindSharedEvents();
  document.querySelector("[data-run]")?.addEventListener("click", () => {
    running = !running;
    startTimer();
    renderSimulator();
  });
  document.querySelector("[data-switch]")?.addEventListener("click", () => {
    config.strategy =
      config.strategy === "demand-first"
        ? "consumer-priority"
        : config.strategy === "consumer-priority"
          ? "prosumer-priority"
          : "demand-first";
    renderSimulator();
  });
  document.querySelector("[data-default]")?.addEventListener("click", () => {
    Object.assign(config, DEFAULT_CONFIG);
    stepIndex = DEFAULT_STEP_INDEX;
    running = true;
    startTimer();
    renderSimulator();
  });
  document.querySelectorAll("[data-strategy]").forEach((button) => {
    button.addEventListener("click", () => {
      config.strategy = button.dataset.strategy;
      renderSimulator();
    });
  });
  document.querySelectorAll("[data-config]").forEach((input) => {
    input.addEventListener("input", () => {
      const key = input.dataset.config;
      config[key] = Number(input.value);
      renderSimulator();
    });
  });
  document.querySelector("[data-step]")?.addEventListener("input", (event) => {
    running = false;
    stepIndex = Number(event.target.value);
    startTimer();
    renderSimulator();
  });
}

function guidePage() {
  app.innerHTML = `
    ${nav()}
    <section class="technical-hero">
      <div class="technical-panel">
        <p class="eyebrow">Paper guide</p>
        <h1>The research paper explained like a smart-neighborhood story.</h1>
        <p>This page translates the paper into simple language while keeping the actual technical meaning intact: PV forecasting, appliance scheduling, DQN battery agents, Central Hub allocation, dynamic pricing, and the simulation results.</p>
        <div class="hero-actions"><a class="primary-action" href="/">Open simulator</a><a class="ghost-action" href="/technical">See formulas</a></div>
      </div>
      <article class="readme-card">
        <h3>One-line idea</h3>
        <p>The paper asks: if some homes have extra solar energy and other homes need electricity, can AI coordinate batteries and sharing so the whole community pays less and wastes less local renewable potential?</p>
      </article>
    </section>
    <section class="guide-shell">
      <aside class="guide-menu" aria-label="Paper guide sections">
        <strong>Guide menu</strong>
        ${GUIDE_NAV.map(([href, label]) => `<a href="#${href}">${label}</a>`).join("")}
      </aside>
      <div class="guide-content">
        <section class="guide-section" id="story">
          <p class="eyebrow">Simple story</p>
          <h2>A neighborhood with solar, batteries, and a shared energy desk.</h2>
          <p>Some houses have rooftop solar panels and batteries, so they can both produce and consume electricity. These are prosumers. Other houses only consume electricity. These are consumers.</p>
          <div class="analogy-box"><h3>Analogy: community fridge</h3><p>If one family cooks too much food, they place the extra in a community fridge. Another family can use it instead of buying food outside. In the paper, surplus solar energy plays the role of extra food, and the Central Hub is the community fridge.</p></div>
        </section>
        <section class="guide-section" id="problem">
          <p class="eyebrow">Problem</p>
          <h2>Solar is available at one time, but demand often appears at another.</h2>
          <p>Traditional grids were built for one-way power flow: power plant to grid to homes. Smart grids are harder because homes can now produce, store, sell, and shift electricity use. Solar is strongest around midday, while household demand often rises in the evening.</p>
          <div class="analogy-box"><h3>Analogy: bakery timing</h3><p>A bakery makes bread at noon, but most customers arrive at night. Storage and sharing are needed; otherwise bread is wasted and people still go hungry later. Batteries and the Central Hub solve the same timing problem for solar power.</p></div>
        </section>
        <section class="guide-section" id="terms">
          <p class="eyebrow">Glossary</p>
          <h2>Terms used in the simulator and paper.</h2>
          <div class="glossary-grid">${GUIDE_TERMS.map(([term, detail]) => `<article class="term-card"><h3>${term}</h3><p>${detail}</p></article>`).join("")}</div>
        </section>
        <section class="guide-section" id="architecture">
          <p class="eyebrow">Architecture</p>
          <h2>The proposed system has three decision layers.</h2>
          <div class="flow-strip">
            <article><span>Layer 1</span><h3>Appliance scheduling</h3><p>Flexible loads are shifted to cheaper or better time windows before battery control starts.</p></article>
            <article><span>Layer 2</span><h3>DQN battery agents</h3><p>Each prosumer chooses charge, discharge, or idle using battery SoC, PV forecast, load, price, and time.</p></article>
            <article><span>Layer 3</span><h3>Central Hub</h3><p>The hub collects surplus PV and reallocates it using Demand-First, Consumer-Priority, or Prosumer-Priority.</p></article>
          </div>
          <div class="analogy-box"><h3>Analogy: school hierarchy</h3><p>Students make small choices, teachers manage classrooms, and the principal manages the school. Similarly, appliances are scheduled first, homes control batteries next, and the Central Hub manages community-level sharing.</p></div>
        </section>
        <section class="guide-section" id="simulation">
          <p class="eyebrow">Simulation setup</p>
          <h2>The simulator is a 24-hour experiment with 15 homes.</h2>
          <div class="fact-grid">${GUIDE_SETUP.map(([label, value]) => `<div><span>${label}</span><strong>${value}</strong></div>`).join("")}</div>
          <p>The 24-hour day is split into 96 small decisions. Every 15 minutes, each prosumer observes its local state, chooses a battery action, and the hub redistributes any surplus energy. This is why the simulator timeline moves through the day.</p>
        </section>
        <section class="guide-section" id="learning">
          <p class="eyebrow">Learning logic</p>
          <h2>The DQN agents learn by score, like a game.</h2>
          <p>Each prosumer agent sees five things: battery charge level, forecasted PV, household load, electricity price, and time of day. It can choose only three actions: charge, discharge, or idle.</p>
          <div class="analogy-box"><h3>Analogy: video game score</h3><p>A player learns which moves increase the score. Here, the score is the reward: reduce grid cost, use PV intelligently, avoid peak pressure, and reduce unmet demand.</p></div>
          <div class="formula-plain"><strong>Reward in plain words</strong><p>Reward = lower electricity cost + useful solar use - peak demand penalty - unmet demand penalty.</p></div>
        </section>
        <section class="guide-section" id="hub">
          <p class="eyebrow">Hub strategies</p>
          <h2>The same surplus energy can be shared with different priorities.</h2>
          <div class="scenario-grid compact">${GUIDE_SCENARIOS.map(([title, detail]) => `<article class="scenario-card"><h3>${title}</h3><p>${detail}</p></article>`).join("")}</div>
        </section>
        <section class="guide-section" id="results">
          <p class="eyebrow">Results</p>
          <h2>What the paper found.</h2>
          <div class="result-callout"><div><span>Average bill</span><strong>₹169.98/day to ₹133.02/day</strong></div><div><span>Bill reduction</span><strong>21.7%</strong></div><div><span>DQN loss</span><strong>&lt; 0.005 by step 2500</strong></div></div>
          <p>The peak demand remains roughly similar, so the improvement is mainly from better timing, battery decisions, and local energy sharing rather than bulk peak shaving. The paper also explains that lower raw PV utilisation in HMARL can be an economic strategy, not a failure.</p>
          <div class="analogy-box"><h3>Analogy: selling fruit at the right time</h3><p>Eating all fruit immediately may maximise immediate usage, but storing some and selling it when demand is higher may be economically smarter. The HMARL agents learn a similar idea for solar energy.</p></div>
        </section>
        <section class="guide-section" id="read-simulator">
          <p class="eyebrow">Using the simulator</p>
          <h2>How the website maps back to the paper.</h2>
          <ul class="guide-list">
            <li><b>Prosumer homes</b> changes how many PV-and-battery homes exist.</li>
            <li><b>Consumer homes</b> changes how much grid-only demand must be served.</li>
            <li><b>PV intensity</b> imitates stronger or weaker solar availability.</li>
            <li><b>Load pressure</b> imitates heavier or lighter community demand.</li>
            <li><b>Battery capacity</b> controls how much energy prosumers can store.</li>
            <li><b>Peak price</b> changes how valuable discharge and hub sharing become during expensive hours.</li>
            <li><b>Manual timeline</b> lets you inspect one of the 96 time steps in the 24-hour simulation.</li>
            <li><b>Set to default</b> restores the report setup: 7 prosumers, 8 consumers, Demand-First allocation, and paper-aligned pricing.</li>
          </ul>
        </section>
      </div>
    </section>
  `;
  bindSharedEvents();
}

function formulasPage() {
  const formulas = [
    ["Prosumer Energy Balance", "P_PV,h^t = P_load,h^t + P_bat,h^t + P_hub,h^t + P_grid,exp,h^t"],
    ["Consumer Energy Balance", "P_load,h^t = P_hub,alloc,h^t + P_grid,imp,h^t"],
    ["Battery SoC Update", "SoC_h^(t+1) = SoC_h^t + (eta_c * P_bat,h^t * Delta t) / C_h^max\nSoC_h^(t+1) = SoC_h^t - (P_bat,h^t * Delta t) / (eta_d * C_h^max)\nSoC_min <= SoC_h^t <= SoC_max"],
    ["PV Forecast Constraint", "0 <= P_PV,h^t <= P_hat_PV,h^t"],
    ["Central Hub Balance", "sum(P_hub,h^t for h in P) = sum(P_hub,alloc,h^t for h in C) + P_hub,loss^t"],
    ["Dynamic ToU Pricing", "lambda^t = lambda_peak, if t in T_peak\nlambda^t = lambda_off, otherwise"],
    ["State Vector", "s_h^t = [SoC_h^t, P_hat_PV,h^t, P_load,h^t, lambda^t, t_norm]"],
    ["Action Space", "A = { CHARGE, DISCHARGE, IDLE }"],
    ["Reward Function", "R_h^t = -Cost_h^t + alpha * phi_PV,h^t - beta * phi_peak,h^t - gamma * phi_unmet,h^t\nalpha = 0.3, beta = 0.2, gamma = 0.5"],
    ["Hub Strategies", "Demand-First, Consumer-Priority, Prosumer-Priority"],
  ];
  app.innerHTML = `
    ${nav()}
    <section class="technical-hero">
      <div class="technical-panel"><p class="eyebrow">Technical formulations</p><h1>Equations used by the HMARL simulator.</h1><p>This page maps simulator controls back to the mathematical structure used in the report.</p><div class="hero-actions"><a class="primary-action" href="/">Open simulator</a><a class="ghost-action" href="/algorithm">View algorithm</a></div></div>
      <div class="technical-panel"><h3>Paper constants preserved</h3><ul><li>24-hour horizon with 96 steps.</li><li>Battery capacity range: 8 to 15 kWh.</li><li>Maximum battery power: 2.5 kW.</li><li>SoC bounds: 0.1 to 0.9.</li><li>Peak price: ₹9.5/kWh; off-peak price: ₹5/kWh.</li></ul></div>
    </section>
    <section class="formula-grid">${formulas.map(([title, code]) => `<article class="formula-card"><h3>${title}</h3><code>${code}</code></article>`).join("")}</section>
  `;
  bindSharedEvents();
}

function algorithmPage() {
  const steps = [
    "Initialise Q-networks and target networks for every prosumer agent.",
    "Create one replay buffer per prosumer.",
    "Run price-aware greedy appliance scheduling once per day.",
    "Select CHARGE, DISCHARGE, or IDLE with epsilon-greedy DQN logic.",
    "Update battery SoC and compute surplus PV injection.",
    "Run the selected Central Hub allocation strategy.",
    "Compute reward using cost, PV utilisation, peak penalty, and unmet demand.",
    "Store transitions and update Q-networks from mini-batches.",
    "Synchronise target networks at the target update interval.",
  ];
  const equations = [
    ["DQN Function Approximation", "Q_theta: R^5 -> R^3\nInput(5) -> FC(64, ReLU) -> FC(64, ReLU) -> FC(3, linear)"],
    ["TD Target", "y = r + gamma * max_a' Q_theta-(s', a')"],
    ["Loss Function", "L(theta) = E[(y - Q_theta(s, a))^2]"],
    ["Bellman Update", "Q(s,a) <- Q(s,a) + alpha * [r + gamma * max_a' Q(s',a') - Q(s,a)]"],
    ["Exploration Decay", "epsilon_t = epsilon_min + (epsilon_0 - epsilon_min) * exp(-lambda_epsilon * t)"],
  ];
  app.innerHTML = `
    ${nav()}
    <section class="technical-hero">
      <div class="technical-panel"><p class="eyebrow">HMARL training algorithm</p><h1>Independent DQN prosumer agents coordinated through a deterministic Central Hub.</h1><p>The simulator follows Layer 1 appliance scheduling, Layer 2 battery action selection, and Layer 3 hub allocation.</p><div class="hero-actions"><a class="primary-action" href="/">Run simulator</a><a class="ghost-action" href="/technical">View formulas</a></div></div>
      <article class="algorithm-card"><h3>Training loop</h3><ol>${steps.map((step) => `<li>${step}</li>`).join("")}</ol></article>
    </section>
    <section class="formula-grid">${equations.map(([title, code]) => `<article class="formula-card"><h3>${title}</h3><code>${code}</code></article>`).join("")}</section>
  `;
  bindSharedEvents();
}

function implementationPage() {
  const blocks = [
    ["Frontend Experience", ["Responsive multi-page interface.", "Animated 24-hour smart-grid simulation.", "Light/dark theme.", "Interactive sliders and segmented controls."]],
    ["Simulation Engine", ["96-step day cycle.", "PV curve from replaceable forecast input.", "Price-aware appliance scheduling.", "DQN-style CHARGE, DISCHARGE, IDLE boundary."]],
    ["Synthetic Database Boundary", ["Deterministic synthetic homes.", "Replaceable with CSV, SQL, or API data.", "API endpoint /api/synthetic-homes.", "No hard-coded absolute paths."]],
    ["Scalability Controls", ["Prosumer and consumer counts are adjustable.", "PV, load, battery, and price changes update outcomes.", "Hub strategy switches live.", "Responsive layout."]],
  ];
  app.innerHTML = `
    ${nav()}
    <section class="technical-hero">
      <div class="technical-panel"><p class="eyebrow">Implementation design</p><h1>Full-stack-ready simulator architecture with replaceable data.</h1><p>The project has a dependency-free Python server for local running and React/Vinext source for later deployment.</p><div class="hero-actions"><a class="primary-action" href="/">Open simulator</a><a class="ghost-action" href="/results">View results</a></div></div>
      <article class="readme-card"><h3>System flow</h3><code>Synthetic or real data\n  -> PV forecasting input\n  -> Layer 1 appliance scheduling\n  -> Layer 2 prosumer battery action\n  -> Layer 3 Central Hub allocation\n  -> metrics, animation, charts, results</code></article>
    </section>
    <section class="implementation-grid">${blocks.map(([title, items]) => `<article class="readme-card"><h3>${title}</h3><ul>${items.map((item) => `<li>${item}</li>`).join("")}</ul></article>`).join("")}</section>
  `;
  bindSharedEvents();
}

function resultsPage() {
  const metrics = [
    ["Average household bill", "₹169.98/day", "₹133.02/day"],
    ["Bill reduction", "0%", "21.7%"],
    ["Peak demand", "37.58 kW", "37.58 kW"],
    ["Prosumer revenue", "₹275.74", "₹585.19"],
    ["Hub utilisation", "0%", "67.2%"],
    ["DQN loss convergence", "N/A", "< 0.005 by step 2500"],
  ];
  const figs = [
    ["/public/research-assets/scenario_metrics.png", "Scenario comparison"],
    ["/public/research-assets/dqn_training_progress.png", "DQN training progress"],
    ["/public/research-assets/pv_utilisation_breakdown.png", "PV utilisation"],
    ["/public/research-assets/hub_allocation.png", "Hub allocation"],
  ];
  app.innerHTML = `
    ${nav()}
    <section class="technical-hero">
      <div class="technical-panel"><p class="eyebrow">Research results</p><h1>Paper metrics and figures connected to the live simulator.</h1><p>These are the fixed report-backed reference values for Conventional, Agent-Based, and proposed HMARL scenarios.</p><div class="hero-actions"><a class="primary-action" href="/">Simulate scenarios</a><a class="ghost-action" href="/technical">Check equations</a></div></div>
      <article class="readme-card"><h3>HMARL vs conventional baseline</h3><div class="metric-table"><div><strong>Metric</strong><strong>Conventional</strong><strong>HMARL</strong></div>${metrics.map((row) => `<div><span>${row[0]}</span><span>${row[1]}</span><span>${row[2]}</span></div>`).join("")}</div></article>
    </section>
    <section class="result-gallery">${figs.map(([src, title]) => `<article class="readme-card"><h3>${title}</h3><img src="${src}" alt="${title}"></article>`).join("")}</section>
  `;
  bindSharedEvents();
}

function render() {
  const route = window.location.pathname;
  if (route === "/guide") guidePage();
  else if (route === "/technical") formulasPage();
  else if (route === "/algorithm") algorithmPage();
  else if (route === "/implementation") implementationPage();
  else if (route === "/results") resultsPage();
  else renderSimulator();
}

function startTimer() {
  if (timer) clearInterval(timer);
  if (!running || window.location.pathname !== "/") return;
  timer = setInterval(() => {
    stepIndex = (stepIndex + 1) % 96;
    renderSimulator();
  }, 850);
}

document.addEventListener("click", (event) => {
  const link = event.target.closest("a[href^='/']");
  if (!link) return;
  event.preventDefault();
  const href = link.getAttribute("href");
  if (href === window.location.pathname) return;
  playPageMotion(true);
  window.setTimeout(() => {
    history.pushState(null, "", href);
    startTimer();
    render();
  }, 90);
});

window.addEventListener("popstate", () => {
  playPageMotion(true);
  startTimer();
  render();
});

setTheme(localStorage.getItem("hmarl-theme") === "dark" ? "dark" : "light");
playPageMotion(false);
render();
startTimer();
