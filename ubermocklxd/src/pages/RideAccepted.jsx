import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import axios from "axios";
import { GoogleMap, Marker, Polyline, useJsApiLoader } from "@react-google-maps/api";

const API_BASE_URL = "https://ubermockendpoint.soratechsol.com";
const API_KEY = "184652892934764538576";
const GOOGLE_MAPS_API_KEY =
  (typeof window !== "undefined" && window.localStorage.getItem("ubermock_google_maps_api_key")) ||
  "";
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
        const liveLocation = toValidCoordPair(data.currentLocation);
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

function toValidCoordPair(input) {
  if (!input) return null;

  if (Array.isArray(input) && input.length >= 2) {
    const lat = Number(input[0]);
    const lng = Number(input[1]);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return [lat, lng];
  }

  const lat = Number(input.lat ?? input.latitude);
  const lng = Number(input.lng ?? input.lon ?? input.longitude);
  if (Number.isFinite(lat) && Number.isFinite(lng)) return [lat, lng];

  if (Array.isArray(input.coordinates) && input.coordinates.length >= 2) {
    const coordLng = Number(input.coordinates[0]);
    const coordLat = Number(input.coordinates[1]);
    if (Number.isFinite(coordLat) && Number.isFinite(coordLng)) return [coordLat, coordLng];
  }

  return null;
}

function RideMap({ pickupCoord, driverCoord, bearing }) {
  const safePickup = toValidCoordPair(pickupCoord);
  const safeDriver = toValidCoordPair(driverCoord);
  const carHeading = ((bearing * 180) / Math.PI + 90) % 360;
  const { isLoaded, loadError } = useJsApiLoader({
    id: "ubermock-google-maps",
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
  });

  if (!safePickup || !safeDriver) {
    return (
      <div className="flex h-[320px] w-full items-center justify-center bg-slate-900 text-sm text-slate-400">
        Map unavailable. Tracking data is still updating.
      </div>
    );
  }

  if (!GOOGLE_MAPS_API_KEY || loadError || !isLoaded) {
    return <RideMapFallback safePickup={safePickup} safeDriver={safeDriver} bearing={bearing} />;
  }

  const pickupPoint = { lat: safePickup[0], lng: safePickup[1] };
  const driverPoint = { lat: safeDriver[0], lng: safeDriver[1] };

  return (
    <GoogleMap
      mapContainerStyle={{ height: "320px", width: "100%" }}
      center={pickupPoint}
      zoom={13}
      options={{
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: false,
      }}
      onLoad={(map) => {
        const bounds = new window.google.maps.LatLngBounds();
        bounds.extend(pickupPoint);
        bounds.extend(driverPoint);
        map.fitBounds(bounds, 64);
      }}
    >
      <Marker position={pickupPoint} label="P" />
      <Marker
        position={driverPoint}
        label="D"
        icon={{
          path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
          scale: 5,
          fillColor: "#14b8a6",
          fillOpacity: 1,
          strokeColor: "#042f2e",
          strokeWeight: 1,
          rotation: carHeading,
        }}
      />
      <Polyline
        path={[driverPoint, pickupPoint]}
        options={{
          strokeColor: "#10b981",
          strokeOpacity: 0.9,
          strokeWeight: 4,
        }}
      />
    </GoogleMap>
  );
}

function RideMapFallback({ safePickup, safeDriver, bearing }) {
  const carHeading = ((bearing * 180) / Math.PI + 90) % 360;

  const minLat = Math.min(safePickup[0], safeDriver[0]);
  const maxLat = Math.max(safePickup[0], safeDriver[0]);
  const minLng = Math.min(safePickup[1], safeDriver[1]);
  const maxLng = Math.max(safePickup[1], safeDriver[1]);

  const latPad = Math.max((maxLat - minLat) * 0.25, 0.002);
  const lngPad = Math.max((maxLng - minLng) * 0.25, 0.002);

  const mapMinLat = minLat - latPad;
  const mapMaxLat = maxLat + latPad;
  const mapMinLng = minLng - lngPad;
  const mapMaxLng = maxLng + lngPad;

  const latSpan = Math.max(mapMaxLat - mapMinLat, 0.00001);
  const lngSpan = Math.max(mapMaxLng - mapMinLng, 0.00001);

  const toPoint = (coord) => {
    const lat = Number(coord[0]);
    const lng = Number(coord[1]);
    const x = ((lng - mapMinLng) / lngSpan) * 100;
    const y = (1 - (lat - mapMinLat) / latSpan) * 100;
    return {
      x: Math.min(96, Math.max(4, x)),
      y: Math.min(96, Math.max(4, y)),
    };
  };

  const pickupPoint = toPoint(safePickup);
  const driverPoint = toPoint(safeDriver);
  const dx = pickupPoint.x - driverPoint.x;
  const dy = pickupPoint.y - driverPoint.y;
  const routeLength = Math.sqrt(dx * dx + dy * dy);
  const routeAngle = (Math.atan2(dy, dx) * 180) / Math.PI;
  return (
    <div className="relative h-[320px] w-full overflow-hidden bg-slate-950">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(16,185,129,0.18),transparent_35%),radial-gradient(circle_at_80%_80%,rgba(56,189,248,0.16),transparent_32%)]" />
      <div className="absolute inset-0 opacity-30 [background-size:28px_28px] [background-image:linear-gradient(to_right,rgba(148,163,184,0.2)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.2)_1px,transparent_1px)]" />
      {!GOOGLE_MAPS_API_KEY && (
        <p className="absolute left-3 top-3 rounded bg-slate-900/80 px-2 py-1 text-[10px] text-slate-300">
          Add VITE_GOOGLE_MAPS_API_KEY to use Google Maps
        </p>
      )}

      <div
        className="absolute h-[2px] origin-left bg-emerald-400/80"
        style={{
          left: `${driverPoint.x}%`,
          top: `${driverPoint.y}%`,
          width: `${routeLength}%`,
          transform: `rotate(${routeAngle}deg)`,
        }}
      />

      <div
        className="absolute -translate-x-1/2 -translate-y-1/2 text-3xl drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]"
        style={{ left: `${pickupPoint.x}%`, top: `${pickupPoint.y}%` }}
      >
        &#128205;
      </div>

      <div
        className="absolute -translate-x-1/2 -translate-y-1/2 text-2xl drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]"
        style={{
          left: `${driverPoint.x}%`,
          top: `${driverPoint.y}%`,
          transform: `translate(-50%, -50%) rotate(${carHeading}deg)`,
        }}
      >
        &#128663;
      </div>
    </div>
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
    const live = toValidCoordPair(tracking?.currentLocation);
    if (live) return live;
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
