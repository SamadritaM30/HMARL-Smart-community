import Link from "next/link";
import SiteNav from "../components/SiteNav";

const formulas = [
  {
    title: "Prosumer Energy Balance",
    body: "For each prosumer home equipped with PV and battery storage.",
    code: `P_PV,h^t = P_load,h^t + P_bat,h^t + P_hub,h^t + P_grid,exp,h^t`,
  },
  {
    title: "Consumer Energy Balance",
    body: "Consumers receive energy from the Central Hub first, then import the remaining demand from the grid.",
    code: `P_load,h^t = P_hub,alloc,h^t + P_grid,imp,h^t`,
  },
  {
    title: "Battery SoC Update",
    body: "Charging and discharging are bounded by the battery capacity and operational SoC range.",
    code: `SoC_h^(t+1) = SoC_h^t + (eta_c * P_bat,h^t * Delta t) / C_h^max

SoC_h^(t+1) = SoC_h^t - (P_bat,h^t * Delta t) / (eta_d * C_h^max)

SoC_min <= SoC_h^t <= SoC_max`,
  },
  {
    title: "PV Forecast Constraint",
    body: "The simulator treats forecasted PV as the available renewable supply boundary.",
    code: `0 <= P_PV,h^t <= P_hat_PV,h^t`,
  },
  {
    title: "Central Hub Balance",
    body: "The hub aggregates prosumer surplus and redistributes it to consumer demand with strategy-specific rules.",
    code: `sum(P_hub,h^t for h in P) =
sum(P_hub,alloc,h^t for h in C) + P_hub,loss^t`,
  },
  {
    title: "Dynamic ToU Pricing",
    body: "Peak pricing runs from 11:00 to 23:00 as specified in the report.",
    code: `lambda^t = lambda_peak, if t in T_peak
lambda^t = lambda_off, otherwise`,
  },
  {
    title: "Prosumer State Vector",
    body: "Each DQN-style prosumer agent observes the same five-dimensional state from the paper.",
    code: `s_h^t = [SoC_h^t, P_hat_PV,h^t, P_load,h^t, lambda^t, t_norm]`,
  },
  {
    title: "Action Space",
    body: "Actions violating SoC limits are masked and replaced with IDLE.",
    code: `A = { CHARGE, DISCHARGE, IDLE }

P_bat,h^t =
  +P_bat^max, if CHARGE
  -P_bat^max, if DISCHARGE
   0,          if IDLE`,
  },
  {
    title: "Reward Function",
    body: "The reward follows the cost, PV utilisation, peak penalty, and unmet demand terms in the report.",
    code: `R_h^t = -Cost_h^t
        + alpha * phi_PV,h^t
        - beta * phi_peak,h^t
        - gamma * phi_unmet,h^t

alpha = 0.3, beta = 0.2, gamma = 0.5`,
  },
  {
    title: "Central Hub Allocation Strategies",
    body: "The three implemented policies are directly exposed as clickable simulator controls.",
    code: `Demand-First:
E_alloc,h^t = E_hub^t * P_load,h^t / sum(P_load,h'^t)

Consumer-Priority:
E_alloc,h^t = min(P_load,h^t * Delta t, E_hub^t / |C|)

Prosumer-Priority:
P_hub,h^t = max(0, P_PV,h^t - P_load,h^t - P_bat,charge^max)`,
  },
];

export default function TechnicalPage() {
  return (
    <main className="app-shell technical-layout">
      <SiteNav />
      <section className="technical-hero">
        <div className="technical-panel">
          <p className="eyebrow">Technical formulations</p>
          <h1>Equations used by the HMARL simulator.</h1>
          <p>
            This page maps the clickable simulator controls back to the exact
            mathematical structure used in the report: household energy
            balance, SoC transitions, PV constraints, ToU pricing, MDP state,
            action space, reward terms, and hub allocation policies.
          </p>
          <div className="hero-actions">
            <Link className="primary-action" href="/">
              Open simulator
            </Link>
            <Link className="ghost-action" href="/algorithm">
              View algorithm
            </Link>
          </div>
        </div>
        <div className="technical-panel">
          <h3>Paper constants preserved</h3>
          <ul>
            <li>24-hour horizon with 96 steps per episode.</li>
            <li>Battery capacity range: 8 to 15 kWh.</li>
            <li>Maximum battery power: 2.5 kW.</li>
            <li>SoC bounds: 0.1 to 0.9.</li>
            <li>Peak price: ₹9.5/kWh; off-peak price: ₹5/kWh.</li>
            <li>Default community: 7 prosumers and 8 consumers.</li>
          </ul>
        </div>
      </section>

      <section className="formula-grid">
        {formulas.map((formula) => (
          <article className="formula-card" key={formula.title}>
            <h3>{formula.title}</h3>
            <p>{formula.body}</p>
            <code>{formula.code}</code>
          </article>
        ))}
      </section>
    </main>
  );
}
