import Link from "next/link";
import SiteNav from "../components/SiteNav";

const metrics = [
  ["Average household bill", "₹169.98/day", "₹133.02/day"],
  ["Bill reduction", "0%", "21.7%"],
  ["Peak demand", "37.58 kW", "37.58 kW"],
  ["Prosumer revenue", "₹275.74", "₹585.19"],
  ["Hub utilisation", "0%", "67.2%"],
  ["DQN loss convergence", "N/A", "< 0.005 by step 2500"],
];

const figures = [
  {
    src: "/research-assets/scenario_metrics.png",
    alt: "Scenario comparison key metrics",
    title: "Scenario comparison",
  },
  {
    src: "/research-assets/dqn_training_progress.png",
    alt: "DQN training progress",
    title: "DQN training progress",
  },
  {
    src: "/research-assets/pv_utilisation_breakdown.png",
    alt: "PV utilisation breakdown",
    title: "PV utilisation",
  },
  {
    src: "/research-assets/hub_allocation.png",
    alt: "Hub allocation strategy comparison",
    title: "Hub allocation",
  },
];

export default function ResultsPage() {
  return (
    <main className="app-shell technical-layout">
      <SiteNav />
      <section className="technical-hero">
        <div className="technical-panel">
          <p className="eyebrow">Research results</p>
          <h1>Paper metrics and figures connected to the live simulator.</h1>
          <p>
            The simulator is interactive, but these results are the fixed
            report-backed reference values: Conventional, Agent-Based baseline,
            and the three proposed HMARL Central Hub strategies.
          </p>
          <div className="hero-actions">
            <Link className="primary-action" href="/">
              Simulate scenarios
            </Link>
            <Link className="ghost-action" href="/technical">
              Check equations
            </Link>
          </div>
        </div>
        <article className="readme-card">
          <h3>HMARL vs conventional baseline</h3>
          <div className="metric-table" role="table" aria-label="Paper metric comparison">
            <div role="row">
              <strong>Metric</strong>
              <strong>Conventional</strong>
              <strong>HMARL</strong>
            </div>
            {metrics.map(([metric, conventional, hmarl]) => (
              <div role="row" key={metric}>
                <span>{metric}</span>
                <span>{conventional}</span>
                <span>{hmarl}</span>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="result-gallery">
        {figures.map((figure) => (
          <article className="readme-card" key={figure.src}>
            <h3>{figure.title}</h3>
            <img src={figure.src} alt={figure.alt} />
          </article>
        ))}
      </section>
    </main>
  );
}
