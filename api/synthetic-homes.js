function seededWave(seed, offset = 0) {
  const raw = Math.sin(seed * 12.9898 + offset * 78.233) * 43758.5453;
  return raw - Math.floor(raw);
}

function boundedInt(value, fallback, minimum, maximum) {
  const parsed = Number.parseInt(Array.isArray(value) ? value[0] : value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(minimum, Math.min(maximum, parsed));
}

export default function handler(request, response) {
  const prosumers = boundedInt(request.query.prosumers, 7, 1, 100);
  const consumers = boundedInt(request.query.consumers, 8, 1, 150);
  const homes = Array.from({ length: prosumers + consumers }, (_, index) => {
    const isProsumer = index < prosumers;
    return {
      id: index + 1,
      label: isProsumer ? `P${index + 1}` : `C${index + 1 - prosumers}`,
      type: isProsumer ? "prosumer" : "consumer",
      baseDemandKw: Number((0.8 + seededWave(index + 1, 1) * 1.25).toFixed(3)),
      pvCapacityKw: isProsumer
        ? Number((2 + seededWave(index + 1, 2) * 4).toFixed(3))
        : 0,
      initialSoc: isProsumer
        ? Number((0.22 + seededWave(index + 1, 7) * 0.55).toFixed(3))
        : null,
      flexibleAppliances: {
        washingMachine: index % 3 === 0,
        geyser: index % 2 === 0,
        riceCooker: index % 4 === 1,
      },
    };
  });

  response.status(200).json({
    source: "deterministic-synthetic-database",
    replaceWith: "CSV, SQL, smart-meter API, or weather/PV dataset",
    prosumers,
    consumers,
    homes,
  });
}
