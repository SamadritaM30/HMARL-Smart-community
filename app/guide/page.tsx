import Link from "next/link";
import SiteNav from "../components/SiteNav";

const guideNav = [
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

const terms = [
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

const setupFacts = [
  ["Community", "15 households: 7 prosumers and 8 consumers."],
  ["Time horizon", "24 hours split into 96 steps, each step lasting 15 minutes."],
  ["PV ratings", "Prosumer PV systems vary from 2 to 6 kW."],
  ["Battery range", "Batteries vary from 8 to 15 kWh with 2.5 kW maximum power."],
  ["Pricing", "Peak price from 11:00 to 23:00; off-peak outside that window."],
  ["Training", "300 episodes with replay buffer, target network, epsilon decay, and DQN updates."],
];

const scenarios = [
  ["Conventional", "No Central Hub, no appliance scheduling, and a fixed battery rule. This is the uncoordinated baseline."],
  ["Agent-Based baseline", "A prior DQN-style baseline is used for comparison, but it does not include the full three-layer community coordination."],
  ["HMARL Demand-First", "Hub energy is allocated in proportion to consumer demand. This is the balanced default policy."],
  ["HMARL Consumer-Priority", "Consumers receive shared energy first, reducing their grid import pressure."],
  ["HMARL Prosumer-Priority", "Prosumers retain more surplus value first, strengthening the incentive to invest in PV and storage."],
];

export default function GuidePage() {
  return (
    <main className="app-shell technical-layout">
      <SiteNav />

      <section className="technical-hero">
        <div className="technical-panel">
          <p className="eyebrow">Paper guide</p>
          <h1>The research paper explained like a smart-neighborhood story.</h1>
          <p>
            This page translates the paper into simple language while keeping
            the actual technical meaning intact: PV forecasting, appliance
            scheduling, DQN battery agents, Central Hub allocation, dynamic
            pricing, and the simulation results.
          </p>
          <div className="hero-actions">
            <Link className="primary-action" href="/">
              Open simulator
            </Link>
            <Link className="ghost-action" href="/technical">
              See formulas
            </Link>
          </div>
        </div>
        <article className="readme-card">
          <h3>One-line idea</h3>
          <p>
            The paper asks: if some homes have extra solar energy and other
            homes need electricity, can AI coordinate batteries and sharing so
            the whole community pays less and wastes less local renewable
            potential?
          </p>
        </article>
      </section>

      <section className="guide-shell">
        <aside className="guide-menu" aria-label="Paper guide sections">
          <strong>Guide menu</strong>
          {guideNav.map(([href, label]) => (
            <a href={`#${href}`} key={href}>
              {label}
            </a>
          ))}
        </aside>

        <div className="guide-content">
          <section className="guide-section" id="story">
            <p className="eyebrow">Simple story</p>
            <h2>A neighborhood with solar, batteries, and a shared energy desk.</h2>
            <p>
              Imagine a residential community. Some houses have rooftop solar
              panels and batteries, so they can both produce and consume
              electricity. These are prosumers. Other houses only consume
              electricity. These are consumers.
            </p>
            <div className="analogy-box">
              <h3>Analogy: community fridge</h3>
              <p>
                If one family cooks too much food, they can place the extra in a
                community fridge. Another family can use it instead of buying
                food outside. In the paper, surplus solar energy plays the role
                of extra food, and the Central Hub is the community fridge.
              </p>
            </div>
          </section>

          <section className="guide-section" id="problem">
            <p className="eyebrow">Problem</p>
            <h2>Solar is available at one time, but demand often appears at another.</h2>
            <p>
              Traditional grids were built for one-way power flow: power plant
              to grid to homes. Smart grids are harder because homes can now
              produce, store, sell, and shift electricity use. Solar is strongest
              around midday, while household demand often rises in the evening.
              Without coordination, clean energy may be wasted or sold cheaply
              while another house imports expensive grid power.
            </p>
            <div className="analogy-box">
              <h3>Analogy: bakery timing</h3>
              <p>
                A bakery makes bread at noon, but most customers arrive at
                night. Storage and sharing are needed; otherwise bread is wasted
                and people still go hungry later. Batteries and the Central Hub
                solve the same timing problem for solar power.
              </p>
            </div>
          </section>

          <section className="guide-section" id="terms">
            <p className="eyebrow">Glossary</p>
            <h2>Terms used in the simulator and paper.</h2>
            <div className="glossary-grid">
              {terms.map(([term, detail]) => (
                <article className="term-card" key={term}>
                  <h3>{term}</h3>
                  <p>{detail}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="guide-section" id="architecture">
            <p className="eyebrow">Architecture</p>
            <h2>The proposed system has three decision layers.</h2>
            <div className="flow-strip">
              <article>
                <span>Layer 1</span>
                <h3>Appliance scheduling</h3>
                <p>Flexible loads are shifted to cheaper or better time windows before battery control starts.</p>
              </article>
              <article>
                <span>Layer 2</span>
                <h3>DQN battery agents</h3>
                <p>Each prosumer chooses charge, discharge, or idle using battery SoC, PV forecast, load, price, and time.</p>
              </article>
              <article>
                <span>Layer 3</span>
                <h3>Central Hub</h3>
                <p>The hub collects surplus PV and reallocates it using Demand-First, Consumer-Priority, or Prosumer-Priority.</p>
              </article>
            </div>
            <div className="analogy-box">
              <h3>Analogy: school hierarchy</h3>
              <p>
                Students make small choices, teachers manage classrooms, and the
                principal manages the school. Similarly, appliances are scheduled
                first, homes control batteries next, and the Central Hub manages
                community-level sharing.
              </p>
            </div>
          </section>

          <section className="guide-section" id="simulation">
            <p className="eyebrow">Simulation setup</p>
            <h2>The simulator is a 24-hour experiment with 15 homes.</h2>
            <div className="fact-grid">
              {setupFacts.map(([label, value]) => (
                <div key={label}>
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
            <p>
              The 24-hour day is split into 96 small decisions. Every 15
              minutes, each prosumer observes its local state, chooses a battery
              action, and the hub redistributes any surplus energy. This is why
              the simulator timeline moves through the day.
            </p>
          </section>

          <section className="guide-section" id="learning">
            <p className="eyebrow">Learning logic</p>
            <h2>The DQN agents learn by score, like a game.</h2>
            <p>
              Each prosumer agent sees five things: battery charge level,
              forecasted PV, household load, electricity price, and time of day.
              It can choose only three actions: charge, discharge, or idle.
            </p>
            <div className="analogy-box">
              <h3>Analogy: video game score</h3>
              <p>
                A player learns which moves increase the score. Here, the score
                is the reward: reduce grid cost, use PV intelligently, avoid
                peak pressure, and reduce unmet demand. Bad decisions reduce the
                reward; useful decisions improve it.
              </p>
            </div>
            <div className="formula-plain">
              <strong>Reward in plain words</strong>
              <p>
                Reward = lower electricity cost + useful solar use - peak demand
                penalty - unmet demand penalty.
              </p>
            </div>
          </section>

          <section className="guide-section" id="hub">
            <p className="eyebrow">Hub strategies</p>
            <h2>The same surplus energy can be shared with different priorities.</h2>
            <div className="scenario-grid compact">
              {scenarios.map(([title, detail]) => (
                <article className="scenario-card" key={title}>
                  <h3>{title}</h3>
                  <p>{detail}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="guide-section" id="results">
            <p className="eyebrow">Results</p>
            <h2>What the paper found.</h2>
            <div className="result-callout">
              <div>
                <span>Average bill</span>
                <strong>₹169.98/day to ₹133.02/day</strong>
              </div>
              <div>
                <span>Bill reduction</span>
                <strong>21.7%</strong>
              </div>
              <div>
                <span>DQN loss</span>
                <strong>&lt; 0.005 by step 2500</strong>
              </div>
            </div>
            <p>
              The peak demand remains roughly similar, so the improvement is
              mainly from better timing, battery decisions, and local energy
              sharing rather than bulk peak shaving. The paper also explains an
              important point: HMARL can show lower raw PV utilisation than the
              conventional case because the agents value economic timing, not
              immediate self-consumption only.
            </p>
            <div className="analogy-box">
              <h3>Analogy: selling fruit at the right time</h3>
              <p>
                Eating all fruit immediately may maximise immediate usage, but
                storing some and selling it when demand is higher may be
                economically smarter. The HMARL agents learn a similar idea for
                solar energy.
              </p>
            </div>
          </section>

          <section className="guide-section" id="read-simulator">
            <p className="eyebrow">Using the simulator</p>
            <h2>How the website maps back to the paper.</h2>
            <ul className="guide-list">
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
    </main>
  );
}
