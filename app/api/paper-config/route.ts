const paperConfig = {
  title: "HMARL Smart Grid Simulator",
  horizon: {
    hours: 24,
    steps: 96,
    deltaHours: 0.25,
  },
  community: {
    defaultProsumers: 7,
    defaultConsumers: 8,
    scalable: true,
  },
  battery: {
    capacityKwhRange: [8, 15],
    maxPowerKw: 2.5,
    socBounds: [0.1, 0.9],
    initialSocRange: [0.2, 0.8],
  },
  pricing: {
    peakPriceInrPerKwh: 9.5,
    offPeakPriceInrPerKwh: 5.0,
    peakHours: [11, 23],
  },
  reward: {
    alphaPvUtilisation: 0.3,
    betaPeakPenalty: 0.2,
    gammaUnmetDemand: 0.5,
  },
  actions: ["CHARGE", "DISCHARGE", "IDLE"],
  hubStrategies: ["Demand-First", "Consumer-Priority", "Prosumer-Priority"],
};

export function GET() {
  return Response.json(paperConfig);
}
