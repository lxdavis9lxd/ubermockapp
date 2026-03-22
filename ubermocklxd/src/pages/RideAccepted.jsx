import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import axios from "axios";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const API_BASE_URL = "https://ubermockendpoint.soratechsol.com";
const API_KEY = "184652892934764538576";
const POLL_INTERVAL_MS = 5000;
const TRACK_PATH_BUILDERS = [
  (id) => `/uberfake/api/simulation/${id}/location`,
  (id) => `/uberfake/api/simulation/${id}/route`,
  (id) => `/rides/${id}/track`,
  (id) => `/track/${id}`,
  (id) => `/api/rides/${id}/track`,
  (id) => `/api/track/${id}`,
];

// ── Tracking hook ─────────────────────────────────────────────────────────

function useRideTracking(ride) {
  const [tracking, setTracking] = useState(() =>
    ride
      ? {
          driverDistanceKm: ride.driverDistanceKm,
          pickupEtaMinutes: ride.pickupEtaMinutes,
          currentLocation: null,
        }
      : null
  );
  const [lastUpdated, setLastUpdated] = useState(null);
  const [pollSource, setPollSource] = useState("waiting");
  const mockDistRef = useRef(ride ? ride.driverDistanceKm : 3.0);

  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      try {
        let authToken = "";
        try {
          authToken = localStorage.getItem("ubermock_api_token") || "";
        } catch {
          authToken = "";
        }

        let res = null;
        for (const buildPath of TRACK_PATH_BUILDERS) {
          try {
            res = await axios.get(`${API_BASE_URL}${buildPath(ride.id)}`, {
              headers: {
                "x-api-key": API_KEY,
                ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
              },
              timeout: 4000,
            });
            break;
          } catch (err) {
            const errorText = (err?.message || "").toLowerCase();
            const status = err?.response?.status;
            const routeMismatch =
              status === 404 ||
              errorText.includes("404") ||
              errorText.includes("not found") ||
              errorText.includes("cannot get") ||
              errorText.includes("route");
            if (!routeMismatch) {
              throw err;
            }
          }
        }

        if (!res) {
          throw new Error("No tracking endpoint matched");
        }

        if (cancelled) return;
        const data = res.data || {};
        const liveLocation = data.currentLocation
          ? [data.currentLocation.lat, data.currentLocation.lng]
          : null;
        setTracking({
          driverDistanceKm: data.driverDistanceKm ?? data.distanceKm ?? mockDistRef.current,
          pickupEtaMinutes: data.pickupEtaMinutes ?? data.etaMinutes ?? tracking?.pickupEtaMinutes,
          currentLocation: liveLocation,
        });
        setPollSource("live");
        setLastUpdated(new Date());
      } catch {
        if (cancelled) return;
        const current = mockDistRef.current;
        const reduction = Number((Math.random() * 0.15 + 0.05).toFixed(2));
        const next = Math.max(0, Number((current - reduction).toFixed(2)));
        mockDistRef.current = next;
        const etaMin = Math.max(0, Math.round(next * 1.5));
        setTracking({ driverDistanceKm: next, pickupEtaMinutes: etaMin, currentLocation: null });
        setPollSource("mock");
        setLastUpdated(new Date());
      }
    };

    poll();
    const id = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ride?.id]);

  return { tracking, lastUpdated, pollSource };
}

// ── Map geometry helpers ──────────────────────────────────────────────────

function seededRandom(n) {
  const x = Math.sin(n + 1) * 10000;
  return x - Math.floor(x);
}

function pickupCoordFromId(id) {
  const s = (id ?? "").split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return [
    41.85 + (seededRandom(s) - 0.5) * 0.08,
    -87.65 + (seededRandom(s + 3) - 0.5) * 0.08,
  ];
}

function bearingFromId(id) {
  const s = (id ?? "").split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return seededRandom(s + 7) * 2 * Math.PI;
}

function calcDriverCoord(lat, lon, distKm, bearing) {
  const latOff = (distKm / 111) * Math.cos(bearing);
  const lonOff = (distKm / (111 * Math.cos((lat * Math.PI) / 180))) * Math.sin(bearing);
  return [lat + latOff, lon + lonOff];
}

const PIN_ICON = L.divIcon({
  html: `<span style="font-size:32px;line-height:1;display:block;filter:drop-shadow(0 2px 4px rgba(0,0,0,.6))">&#128205;</span>`,
  className: "",
  iconSize: [32, 32],
  iconAnchor: [16, 32],
});

function makeCarIcon(bearingRad) {
  const cssRot = ((bearingRad * 180) / Math.PI + 90) % 360;
  return L.divIcon({
    html: `<span style="font-size:28px;line-height:1;display:block;transform:rotate(${cssRot}deg);filter:drop-shadow(0 2px 4px rgba(0,0,0,.8))">&#128663;</span>`,
    className: "",
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

function FitBoundsOnce({ pos1, pos2 }) {
  const map = useMap();
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    map.fitBounds(L.latLngBounds([pos1, pos2]), { padding: [60, 60], maxZoom: 15 });
    done.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

function RideMap({ pickupCoord, driverCoord, bearing }) {
  const carIcon = useMemo(() => makeCarIcon(bearing), [bearing]);

  return (
    <MapContainer
      center={pickupCoord}
      zoom={14}
      scrollWheelZoom={false}
      style={{ height: "320px", width: "100%", borderRadius: "0.5rem" }}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution="&copy; <a href='https://openstreetmap.org/copyright'>OpenStreetMap</a> contributors &copy; <a href='https://carto.com/attributions'>CARTO</a>"
        subdomains="abcd"
        maxZoom={19}
      />
      <Marker position={pickupCoord} icon={PIN_ICON} />
      <Marker position={driverCoord} icon={carIcon} />
      <FitBoundsOnce pos1={pickupCoord} pos2={driverCoord} />
    </MapContainer>
  );
}

// ── Main component ────────────────────────────────────────────────────────

export default function RideAccepted() {
  const location = useLocation();

  const ride = useMemo(() => {
    const fromState = location.state?.ride;
    if (fromState) return fromState;
    try {
      const stored = localStorage.getItem("ubermock_last_ride");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }, [location.state]);

  const { tracking, lastUpdated, pollSource } = useRideTracking(ride);

  const pickupCoord = useMemo(
    () => pickupCoordFromId(ride?.id),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ride?.id]
  );
  const bearing = useMemo(
    () => bearingFromId(ride?.id),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ride?.id]
  );
  const driverCoord = useMemo(() => {
    if (tracking?.currentLocation) return tracking.currentLocation;
    const dist = tracking?.driverDistanceKm ?? ride?.driverDistanceKm ?? 1.5;
    return calcDriverCoord(pickupCoord[0], pickupCoord[1], dist, bearing);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tracking?.currentLocation, tracking?.driverDistanceKm]);

  if (!ride) {
    return (
      <div className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100">
        <div className="mx-auto max-w-xl rounded-lg border border-slate-800 bg-slate-900/70 p-6">
          <h1 className="text-2xl font-bold">Ride Accepted</h1>
          <p className="mt-2 text-sm text-slate-300">No recent ride found. Book a ride first.</p>
          <Link
            to="/"
            className="mt-5 inline-flex h-10 items-center rounded-md bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-500"
          >
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  const arrived = tracking?.driverDistanceKm <= 0;

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100">
      <div className="mx-auto max-w-2xl space-y-4">

        {/* Header card */}
        <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-6 shadow-sm">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">ubermock</p>
          <h1 className="mt-1 text-3xl font-bold text-white">Ride Accepted</h1>
          {arrived ? (
            <p className="mt-2 text-sm font-semibold text-emerald-300">Your driver has arrived!</p>
          ) : (
            <p className="mt-2 text-sm text-emerald-300">Your driver is on the way to pickup.</p>
          )}
          <div className="mt-3 flex items-center gap-2 text-xs text-slate-400">
            <span
              className={`inline-block h-2 w-2 shrink-0 rounded-full ${
                pollSource === "live"
                  ? "bg-emerald-400 animate-pulse"
                  : pollSource === "mock"
                  ? "bg-amber-400 animate-pulse"
                  : "bg-slate-600"
              }`}
            />
            {pollSource === "live" && "Live tracking (updates every 5 s)"}
            {pollSource === "mock" && "Simulated tracking \u2014 API unavailable (updates every 5 s)"}
            {pollSource === "waiting" && "Connecting to tracking service\u2026"}
            {lastUpdated && (
              <span className="ml-auto shrink-0 text-slate-500">
                Updated {lastUpdated.toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>

        {/* Live map */}
        <div className="overflow-hidden rounded-lg border border-slate-800 shadow-sm">
          <RideMap pickupCoord={pickupCoord} driverCoord={driverCoord} bearing={bearing} />
          <div className="flex items-center justify-between bg-slate-900/90 px-3 py-2 text-xs text-slate-400">
            <span>&#128205; Pickup &nbsp;&middot;&nbsp; &#128663; Driver</span>
            <span>Map updates every 5 s</span>
          </div>
        </div>

        {/* Stats */}
        <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-6 shadow-sm">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-slate-700 bg-slate-950 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-400">Booking ID</p>
              <p className="mt-1 text-lg font-semibold text-white">{ride.id}</p>
            </div>

            <div className="rounded-lg border border-emerald-700/50 bg-slate-950 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-400">Distance To Pickup</p>
              {tracking ? (
                <p className="mt-1 text-2xl font-bold text-emerald-400">
                  {tracking.driverDistanceKm} km
                </p>
              ) : (
                <div className="mt-1 h-7 w-16 animate-pulse rounded bg-slate-800" />
              )}
            </div>

            <div className="rounded-lg border border-slate-700 bg-slate-950 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-400">Driver ETA To Pickup</p>
              {tracking ? (
                <p className="mt-1 text-lg font-semibold text-white">
                  {tracking.pickupEtaMinutes} min
                </p>
              ) : (
                <div className="mt-1 h-6 w-12 animate-pulse rounded bg-slate-800" />
              )}
            </div>

            <div className="rounded-lg border border-slate-700 bg-slate-950 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-400">Fare</p>
              <p className="mt-1 text-lg font-semibold text-white">${ride.fare}</p>
            </div>
          </div>

          <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950 p-4 text-sm text-slate-200">
            <p><span className="text-slate-400">Pickup:</span> {ride.pickup}</p>
            <p className="mt-1"><span className="text-slate-400">Dropoff:</span> {ride.dropoff}</p>
            <p className="mt-1">
              <span className="text-slate-400">Ride Type:</span>{" "}
              <span className="uppercase">{ride.rideType}</span>
            </p>
          </div>

          <Link
            to="/"
            className="mt-6 inline-flex h-10 items-center rounded-md border border-slate-700 bg-slate-800 px-4 text-sm font-medium text-slate-100 hover:bg-slate-700"
          >
            Book Another Ride
          </Link>
        </div>
      </div>
    </div>
  );
}
