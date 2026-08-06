from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse
import argparse
import json
import math


ROOT = Path(__file__).resolve().parent


def seeded_wave(seed: int, offset: int = 0) -> float:
    raw = math.sin(seed * 12.9898 + offset * 78.233) * 43758.5453
    return raw - math.floor(raw)


def bounded_int(value, fallback: int, minimum: int, maximum: int) -> int:
    try:
        parsed = int(float(value[0])) if value else fallback
    except (TypeError, ValueError):
        parsed = fallback
    return max(minimum, min(maximum, parsed))


PAPER_CONFIG = {
    "title": "HMARL Smart Grid Simulator",
    "horizon": {"hours": 24, "steps": 96, "deltaHours": 0.25},
    "community": {"defaultProsumers": 7, "defaultConsumers": 8, "scalable": True},
    "battery": {
        "capacityKwhRange": [8, 15],
        "maxPowerKw": 2.5,
        "socBounds": [0.1, 0.9],
        "initialSocRange": [0.2, 0.8],
    },
    "pricing": {
        "peakPriceInrPerKwh": 9.5,
        "offPeakPriceInrPerKwh": 5.0,
        "peakHours": [11, 23],
    },
    "reward": {
        "alphaPvUtilisation": 0.3,
        "betaPeakPenalty": 0.2,
        "gammaUnmetDemand": 0.5,
    },
    "actions": ["CHARGE", "DISCHARGE", "IDLE"],
    "hubStrategies": ["Demand-First", "Consumer-Priority", "Prosumer-Priority"],
}


class HMARLHandler(SimpleHTTPRequestHandler):
    def translate_path(self, path):
        clean = urlparse(path).path.lstrip("/")
        return str(ROOT / clean)

    def send_json(self, payload):
        body = json.dumps(payload, indent=2).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path == "/api/paper-config":
            self.send_json(PAPER_CONFIG)
            return

        if path == "/api/synthetic-homes":
            query = parse_qs(parsed.query)
            prosumers = bounded_int(query.get("prosumers"), 7, 1, 100)
            consumers = bounded_int(query.get("consumers"), 8, 1, 150)
            homes = []
            for index in range(prosumers + consumers):
                is_prosumer = index < prosumers
                homes.append(
                    {
                        "id": index + 1,
                        "label": f"P{index + 1}" if is_prosumer else f"C{index + 1 - prosumers}",
                        "type": "prosumer" if is_prosumer else "consumer",
                        "baseDemandKw": round(0.8 + seeded_wave(index + 1, 1) * 1.25, 3),
                        "pvCapacityKw": round(2 + seeded_wave(index + 1, 2) * 4, 3) if is_prosumer else 0,
                        "initialSoc": round(0.22 + seeded_wave(index + 1, 7) * 0.55, 3) if is_prosumer else None,
                        "flexibleAppliances": {
                            "washingMachine": index % 3 == 0,
                            "geyser": index % 2 == 0,
                            "riceCooker": index % 4 == 1,
                        },
                    }
                )
            self.send_json(
                {
                    "source": "deterministic-synthetic-database",
                    "replaceWith": "CSV, SQL/D1, smart-meter API, or weather/PV dataset",
                    "prosumers": prosumers,
                    "consumers": consumers,
                    "homes": homes,
                }
            )
            return

        if path == "/app/tailwindcss":
            self.send_response(204)
            self.send_header("Content-Type", "text/css")
            self.end_headers()
            return

        if path in {"/", "/guide", "/technical", "/algorithm", "/implementation", "/results"}:
            index_path = ROOT / "web" / "index.html"
            body = index_path.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return

        return super().do_GET()


def main():
    parser = argparse.ArgumentParser(description="Run the HMARL simulator locally.")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", default=8000, type=int)
    args = parser.parse_args()

    server = ThreadingHTTPServer((args.host, args.port), HMARLHandler)
    print(f"HMARL simulator running at http://{args.host}:{args.port}")
    print("Press Ctrl+C to stop.")
    server.serve_forever()


if __name__ == "__main__":
    main()
