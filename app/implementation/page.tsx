import Link from "next/link";
import SiteNav from "../components/SiteNav";

const implementationBlocks = [
  {
    title: "Frontend Experience",
    body: [
      "Responsive multi-page React interface.",
      "Animated 24-hour smart-grid simulation with prosumers, consumers, Central Hub, and grid.",
      "Light and dark theme toggle persisted in browser storage.",
      "Interactive sliders and segmented controls for live scenario changes.",
    ],
  },
  {
    title: "Simulation Engine",
    body: [
      "96-step day cycle with 15-minute resolution.",
      "PV curve generated from replaceable forecast input.",
      "Price-aware appliance scheduling before battery control.",
      "DQN-style policy boundary over CHARGE, DISCHARGE, and IDLE actions.",
      "Reward terms follow the paper coefficients: alpha 0.3, beta 0.2, gamma 0.5.",
    ],
  },
  {
    title: "Synthetic Database Boundary",
    body: [
      "Community homes are generated from deterministic synthetic seeds.",
      "PV capacity, load bias, appliance participation, and initial SoC are isolated from UI code.",
      "The same structure can be replaced by real household and weather data.",
      "The current browser-first implementation avoids hard-coded absolute paths.",
      "API route /api/synthetic-homes exposes the replaceable home-record contract.",
    ],
  },
  {
    title: "Scalability Controls",
    body: [
      "Prosumer and consumer counts are adjustable from the simulator.",
      "PV intensity, load pressure, battery capacity, and peak price change outcomes live.",
      "Central Hub strategy can be switched without rebuilding the simulation.",
      "API route /api/paper-config exposes the paper constants used by the UI.",
      "The visual layout adapts to mobile, tablet, and desktop screens.",
    ],
  },
];

export default function ImplementationPage() {
  return (
    <main className="app-shell technical-layout">
      <SiteNav />
      <section className="technical-hero">
        <div className="technical-panel">
          <p className="eyebrow">Implementation design</p>
          <h1>Full-stack-ready simulator architecture with replaceable data.</h1>
          <p>
            This build is structured as a deployable web application. The first
            implementation keeps simulation and synthetic data local for fast
            hosting, while keeping the data boundary clean enough to replace
            synthetic homes with CSV, API, or database-backed records.
          </p>
          <div className="hero-actions">
            <Link className="primary-action" href="/">
              Open simulator
            </Link>
            <Link className="ghost-action" href="/results">
              View results
            </Link>
          </div>
        </div>
        <article className="readme-card">
          <h3>System flow</h3>
          <code>{`Synthetic or real data
  -> PV forecasting input
  -> Layer 1 appliance scheduling
  -> Layer 2 prosumer battery action
  -> Layer 3 Central Hub allocation
  -> metrics, animation, charts, results`}</code>
        </article>
      </section>

      <section className="implementation-grid">
        {implementationBlocks.map((block) => (
          <article className="readme-card" key={block.title}>
            <h3>{block.title}</h3>
            <ul>
              {block.body.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
        ))}
      </section>
    </main>
  );
}
