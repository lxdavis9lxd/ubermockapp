import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ApiClient } from "@/utils/apiClient.js";

const API_BASE_URL = "https://ubermockendpoint.soratechsol.com";
const API_KEY = "184652892934764538576";
const ESTIMATE_PATHS = ["/uberfake/api/rides/request", "/rides/estimate", "/estimate"];
const BOOK_PATHS = ["/uberfake/api/rides/request", "/rides/book", "/book"];
const AUTH_LOGIN_PATHS = ["/uberfake/api/auth/login", "/auth/login"];
const AUTH_REGISTER_PATHS = ["/uberfake/api/auth/register", "/auth/register"];
const GUEST_PASSWORD = "password123";
const DEFAULT_PICKUP_COORDS = [-87.9525, 43.0468];
const DEFAULT_DROPOFF_COORDS = [-87.8966, 42.9472];

const rideTypeMultiplier = {
  uberx: 1,
  comfort: 1.35,
  black: 1.9,
};

const rideTypeApiMap = {
  uberx: "economy",
  comfort: "comfort",
  black: "luxury",
};

export default function Home() {
  const navigate = useNavigate();
  const [pickup, setPickup] = useState("");
  const [dropoff, setDropoff] = useState("");
  const [rideType, setRideType] = useState("uberx");
  const [estimate, setEstimate] = useState(null);
  const [bookingState, setBookingState] = useState("idle");
  const [history, setHistory] = useState([]);
  const [apiError, setApiError] = useState("");
  const [apiMode, setApiMode] = useState("remote");

  const client = useMemo(() => {
    const instance = new ApiClient(API_BASE_URL);
    instance.instance.defaults.headers.common["x-api-key"] = API_KEY;
    return instance;
  }, []);

  const canRequestRide = pickup.trim() && dropoff.trim() && rideType;

  const postWithFallback = async (paths, payload) => {
    let lastResponse = null;

    for (const path of paths) {
      const response = await client.create(path, payload);
      if (response.success) return response;

      lastResponse = response;
      const errorText = (response.error || "").toLowerCase();
      const isRouteMismatch =
        errorText.includes("not found") ||
        errorText.includes("404") ||
        errorText.includes("cannot post") ||
        errorText.includes("route");

      if (!isRouteMismatch) {
        return response;
      }
    }

    return lastResponse || { success: false, error: "No API endpoint matched." };
  };

  const setAuthHeader = (token) => {
    if (token) {
      client.instance.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    } else {
      delete client.instance.defaults.headers.common["Authorization"];
    }
  };

  const getGuestIdentity = () => {
    try {
      const cachedEmail = localStorage.getItem("ubermock_guest_email");
      const cachedPhone = localStorage.getItem("ubermock_guest_phone");
      if (cachedEmail && cachedPhone) {
        return { email: cachedEmail, phone: cachedPhone };
      }

      const seed = Date.now();
      const email = `ubermock_guest_${seed}@example.com`;
      const phone = `414555${Math.floor(1000 + Math.random() * 9000)}`;
      localStorage.setItem("ubermock_guest_email", email);
      localStorage.setItem("ubermock_guest_phone", phone);
      return { email, phone };
    } catch {
      const seed = Date.now();
      return {
        email: `ubermock_guest_${seed}@example.com`,
        phone: `414555${Math.floor(1000 + Math.random() * 9000)}`,
      };
    }
  };

  const ensureAuthToken = async () => {
    try {
      const storedToken = localStorage.getItem("ubermock_api_token");
      if (storedToken) {
        setAuthHeader(storedToken);
        return { success: true };
      }
    } catch {
      // Continue with runtime registration/login if storage is unavailable.
    }

    const { email, phone } = getGuestIdentity();
    let loginResponse = await postWithFallback(AUTH_LOGIN_PATHS, {
      email,
      password: GUEST_PASSWORD,
    });

    if (!loginResponse.success) {
      const registerResponse = await postWithFallback(AUTH_REGISTER_PATHS, {
        name: "Ubermock Guest",
        email,
        phone,
        password: GUEST_PASSWORD,
        role: "rider",
      });

      if (!registerResponse.success) {
        return {
          success: false,
          error: registerResponse.error || "Unable to register guest account.",
        };
      }

      loginResponse = await postWithFallback(AUTH_LOGIN_PATHS, {
        email,
        password: GUEST_PASSWORD,
      });
    }

    const token = loginResponse.data?.token;
    if (!token) {
      return { success: false, error: loginResponse.error || "No auth token returned." };
    }

    try {
      localStorage.setItem("ubermock_api_token", token);
    } catch {
      // Token still works for current page session via in-memory header.
    }
    setAuthHeader(token);
    return { success: true };
  };

  const buildRideRequestPayload = () => ({
    pickupLocation: {
      address: pickup,
      coordinates: DEFAULT_PICKUP_COORDS,
    },
    dropoffLocation: {
      address: dropoff,
      coordinates: DEFAULT_DROPOFF_COORDS,
    },
    rideType: rideTypeApiMap[rideType] || "economy",
  });

  const buildLocalEstimate = () => ({
    etaMinutes: 8,
    fare: Number((17.0 * rideTypeMultiplier[rideType]).toFixed(2)),
    distanceKm: 6.5,
  });

  const normalizeApiError = (message) => {
    const text = (message || "").toLowerCase();
    if (text.includes("network error") || text.includes("failed to fetch")) {
      return "Cannot reach API from this browser session. Check internet/CORS access for ubermockendpoint.soratechsol.com.";
    }
    return message || "API endpoint unavailable. Running in local mock mode.";
  };

  const switchToMockMode = (message) => {
    setApiMode("mock");
    setApiError(normalizeApiError(message));
  };

  const createAcceptedRide = (bookingId, responseData) => ({
    id: bookingId,
    pickup,
    dropoff,
    rideType,
    fare: estimate.fare,
    etaMinutes: estimate.etaMinutes,
    driverDistanceKm:
      responseData?.driverDistanceKm ?? Number((Math.random() * 2 + 0.6).toFixed(1)),
    pickupEtaMinutes:
      responseData?.pickupEtaMinutes ?? Math.max(2, Math.round((estimate.etaMinutes || 8) / 2)),
  });

  const openRideAcceptedPage = (ride) => {
    try {
      localStorage.setItem("ubermock_last_ride", JSON.stringify(ride));
    } catch {
      // Storage failures should not block navigation.
    }
    navigate("/ride-accepted", { state: { ride } });
  };

  const requestEstimate = async () => {
    if (!canRequestRide) {
      setApiError("Pickup, dropoff, and ride type are required.");
      return;
    }

    setBookingState("estimating");
    setApiError("");

    if (apiMode === "mock") {
      setEstimate(buildLocalEstimate());
      setBookingState("idle");
      toast.success("Estimate ready (mock mode).");
      return;
    }

    const auth = await ensureAuthToken();
    if (!auth.success) {
      setEstimate(buildLocalEstimate());
      switchToMockMode(auth.error || "API authentication failed. Switched to local mock mode.");
      toast.error("API auth failed. Switched to mock mode.");
      setBookingState("idle");
      return;
    }

    const payload = buildRideRequestPayload();

    const response = await postWithFallback(ESTIMATE_PATHS, payload);

    if (response.success) {
      const data = response.data || {};
      const estimatedFare = data.ride?.fare?.estimatedFare;
      setEstimate({
        etaMinutes: data.etaMinutes ?? 6,
        fare: estimatedFare ?? data.fare ?? Number((18.5 * rideTypeMultiplier[rideType]).toFixed(2)),
        distanceKm: data.distanceKm ?? 7.2,
      });
      toast.success("Estimate ready.");
    } else {
      setEstimate(buildLocalEstimate());
      switchToMockMode(response.error || "Endpoint error. Switched to local mock mode.");
      toast.error("Endpoint unavailable. Switched to mock mode.");
    }

    setBookingState("idle");
  };

  const bookRide = async () => {
    if (!estimate) {
      setApiError("Get an estimate before booking.");
      return;
    }

    setBookingState("booking");
    setApiError("");

    try {
      if (apiMode === "mock") {
        const bookingId = `UBR-${Date.now()}`;
        const acceptedRide = createAcceptedRide(bookingId);
        setHistory((prev) => [acceptedRide, ...prev]);
        toast.success("Ride booked (mock mode).");
        openRideAcceptedPage(acceptedRide);
        return;
      }

      const auth = await ensureAuthToken();
      if (!auth.success) {
        const bookingId = `UBR-${Date.now()}`;
        const acceptedRide = createAcceptedRide(bookingId);
        setHistory((prev) => [acceptedRide, ...prev]);
        switchToMockMode(auth.error || "API authentication failed. Booking saved in local mock mode.");
        toast.error("API auth failed. Booking saved in mock mode.");
        openRideAcceptedPage(acceptedRide);
        return;
      }

      const payload = buildRideRequestPayload();
      const response = await postWithFallback(BOOK_PATHS, payload);

      const bookingId = response.success
        ? response.data?.ride?._id || response.data?.bookingId || `UBR-${Date.now()}`
        : `UBR-${Date.now()}`;

      if (!response.success) {
        switchToMockMode(response.error || "Booking endpoint error. Switched to local mock mode.");
        toast.error("Endpoint unavailable. Booking saved in mock mode.");
      } else {
        toast.success("Ride booked.");
      }

      const acceptedRide = createAcceptedRide(bookingId, response.data);
      setHistory((prev) => [acceptedRide, ...prev]);
      openRideAcceptedPage(acceptedRide);
    } catch (error) {
      const bookingId = `UBR-${Date.now()}`;
      const acceptedRide = createAcceptedRide(bookingId);
      setHistory((prev) => [acceptedRide, ...prev]);
      switchToMockMode(error?.message || "Unexpected booking error. Saved in local mock mode.");
      toast.error("Booking failed unexpectedly. Saved in mock mode.");
      openRideAcceptedPage(acceptedRide);
    } finally {
      setBookingState("idle");
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Mock ride app</p>
            <h1 className="text-4xl font-bold text-white">ubermock</h1>
            <p className="mt-1 text-sm text-slate-300">A mock version of the Uber app.</p>
          </div>
          <span className="inline-flex items-center rounded-full border border-emerald-500/70 bg-emerald-600 px-3 py-1 text-xs font-semibold text-white">
            endpoint: ubermockendpoint.soratechsol.com
          </span>
          <span className="inline-flex items-center rounded-full border border-slate-600 bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-200">
            mode: {apiMode}
          </span>
        </header>

        {apiError && (
          <div className="mb-6 rounded-lg border border-amber-500/60 bg-amber-900/30 p-4 text-amber-100">
            <p className="font-semibold">API notice</p>
            <p className="text-sm">{apiError}</p>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="rounded-lg border border-slate-800 bg-slate-900/70 p-6 shadow-sm">
            <h2 className="mb-4 text-xl font-semibold">Request a Ride</h2>
            <div className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="pickup" className="text-sm font-medium text-slate-200">Pickup</label>
                <input
                  id="pickup"
                  value={pickup}
                  onChange={(event) => setPickup(event.target.value)}
                  placeholder="123 Main St"
                  className="h-10 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 placeholder:text-slate-500"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="dropoff" className="text-sm font-medium text-slate-200">Dropoff</label>
                <input
                  id="dropoff"
                  value={dropoff}
                  onChange={(event) => setDropoff(event.target.value)}
                  placeholder="Airport Terminal B"
                  className="h-10 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 placeholder:text-slate-500"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="rideType" className="text-sm font-medium text-slate-200">Ride Type</label>
                <select
                  id="rideType"
                  value={rideType}
                  onChange={(event) => setRideType(event.target.value)}
                  className="h-10 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
                >
                  <option value="uberx">UberX</option>
                  <option value="comfort">Comfort</option>
                  <option value="black">Black</option>
                </select>
              </div>

              <div className="flex flex-wrap gap-3 pt-2">
                <button
                  onClick={requestEstimate}
                  disabled={bookingState !== "idle" || !canRequestRide}
                  className="inline-flex h-10 items-center rounded-md bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {bookingState === "estimating" ? "Calculating..." : "Get Estimate"}
                </button>
                <button
                  onClick={bookRide}
                  disabled={bookingState !== "idle" || !estimate}
                  className="inline-flex h-10 items-center rounded-md border border-slate-700 bg-slate-800 px-4 text-sm font-medium text-slate-100 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {bookingState === "booking" ? "Booking..." : "Book Ride"}
                </button>
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-slate-800 bg-slate-900/70 p-6 shadow-sm">
            <h2 className="mb-4 text-xl font-semibold">Trip Estimate</h2>
            <div className="space-y-3">
              {!estimate && (
                <p className="text-sm text-slate-300">
                  Enter pickup and dropoff, then click Get Estimate.
                </p>
              )}
              {estimate && (
                <>
                  <div className="rounded-lg border border-slate-700 bg-slate-950 p-3">
                    <p className="text-sm text-slate-300">ETA</p>
                    <p className="text-2xl font-semibold text-white">{estimate.etaMinutes} min</p>
                  </div>
                  <div className="rounded-lg border border-slate-700 bg-slate-950 p-3">
                    <p className="text-sm text-slate-300">Fare</p>
                    <p className="text-2xl font-semibold text-white">${estimate.fare}</p>
                  </div>
                  <div className="rounded-lg border border-slate-700 bg-slate-950 p-3">
                    <p className="text-sm text-slate-300">Distance</p>
                    <p className="text-2xl font-semibold text-white">{estimate.distanceKm} km</p>
                  </div>
                </>
              )}
            </div>
          </section>
        </div>

        <hr className="my-8 border-slate-800" />

        <section className="rounded-lg border border-slate-800 bg-slate-900/70 p-6 shadow-sm">
          <h2 className="mb-4 text-xl font-semibold">Recent Mock Bookings</h2>
          <div>
            {history.length === 0 ? (
              <p className="text-sm text-slate-300">No rides booked yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px] text-sm">
                  <thead>
                    <tr className="border-b border-slate-700 text-left text-slate-300">
                      <th className="px-3 py-3">Booking ID</th>
                      <th className="px-3 py-3">Route</th>
                      <th className="px-3 py-3">Type</th>
                      <th className="px-3 py-3">ETA</th>
                      <th className="px-3 py-3">Fare</th>
                    </tr>
                  </thead>
                  <tbody>
                  {history.map((ride) => (
                    <tr key={ride.id} className="border-b border-slate-800 text-slate-100 last:border-0">
                      <td className="px-3 py-3">{ride.id}</td>
                      <td className="px-3 py-3">{ride.pickup} to {ride.dropoff}</td>
                      <td className="px-3 py-3 uppercase">{ride.rideType}</td>
                      <td className="px-3 py-3">{ride.etaMinutes} min</td>
                      <td className="px-3 py-3">${ride.fare}</td>
                    </tr>
                  ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
