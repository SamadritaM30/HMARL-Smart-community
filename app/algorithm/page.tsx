import Link from "next/link";
import SiteNav from "../components/SiteNav";

const algorithmSteps = [
  "Initialise Q-networks and target networks for every prosumer agent.",
  "Create one replay buffer per prosumer.",
  "Run the price-aware greedy appliance scheduler once per simulated day.",
  "For each episode, reset the environment and observe local prosumer states.",
  "At each 15-minute step, select CHARGE, DISCHARGE, or IDLE with epsilon-greedy DQN logic.",
  "Update battery SoC and compute surplus PV injection to the Central Hub.",
  "Run the deterministic Central Hub allocation policy selected by the user.",
  "Compute reward using cost, PV utilisation, peak penalty, and unmet demand terms.",
  "Store transitions in replay memory and update Q-networks from mini-batches.",
  "Synchronise target networks every configured target-update interval.",
];

const equations = [
  {
    title: "DQN Function Approximation",
    code: `Q_theta: R^5 -> R^3

Input(5) -> FC(64, ReLU) -> FC(64, ReLU) -> FC(3, linear)`,
  },
  {
    title: "Temporal Difference Target",
    code: `y = r + gamma * max_a' Q_theta-(s', a')`,
  },
  {
    title: "Loss Function",
    code: `L(theta) = E[(y - Q_theta(s, a))^2]`,
  },
  {
    title: "Bellman Update",
    code: `Q(s,a) <- Q(s,a) + alpha * [r + gamma * max_a' Q(s',a') - Q(s,a)]`,
  },
  {
    title: "Gradient Step",
    code: `theta <- theta - eta * grad_theta L(theta)`,
  },
  {
    title: "Exploration Decay",
    code: `epsilon_t = epsilon_min + (epsilon_0 - epsilon_min) * exp(-lambda_epsilon * t)`,
  },
];

export default function AlgorithmPage() {
  return (
    <main className="app-shell technical-layout">
      <SiteNav />
      <section className="technical-hero">
        <div className="technical-panel">
          <p className="eyebrow">HMARL training algorithm</p>
          <h1>Independent DQN prosumer agents coordinated through a deterministic Central Hub.</h1>
          <p>
            The implementation page and simulator are organised around this
            procedure: Layer 1 pre-computes price-aware appliance schedules,
            Layer 2 selects battery actions for prosumers, and Layer 3 allocates
            shared energy through the hub.
          </p>
          <div className="hero-actions">
            <Link className="primary-action" href="/">
              Run simulator
            </Link>
            <Link className="ghost-action" href="/technical">
              View formulas
            </Link>
          </div>
        </div>
        <article className="algorithm-card">
          <h3>Training loop</h3>
          <ol>
            {algorithmSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </article>
      </section>

      <section className="formula-grid">
        {equations.map((item) => (
          <article className="formula-card" key={item.title}>
            <h3>{item.title}</h3>
            <code>{item.code}</code>
          </article>
        ))}
      </section>
    </main>
  );
}
