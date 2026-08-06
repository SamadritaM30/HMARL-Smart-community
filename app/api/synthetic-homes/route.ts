const seededWave = (seed: number, offset = 0) =>
  Math.sin(seed * 12.9898 + offset * 78.233) * 43758.5453 -
  Math.floor(Math.sin(seed * 12.9898 + offset * 78.233) * 43758.5453);

const clampInteger = (value: string | null, fallback: number, min: number, max: number) => {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
};

export function GET(request: Request) {
  const url = new URL(request.url);
  const prosumers = clampInteger(url.searchParams.get("prosumers"), 7, 1, 100);
  const consumers = clampInteger(url.searchParams.get("consumers"), 8, 1, 150);

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

  return Response.json({
    source: "deterministic-synthetic-database",
    replaceWith: "CSV, SQL/D1, smart-meter API, or weather/PV dataset",
    prosumers,
    consumers,
    homes,
  });
}
