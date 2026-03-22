import { Routes, Route } from "react-router-dom";
import Home from "./pages/Home.jsx";
import RideAccepted from "./pages/RideAccepted.jsx";
import ComponentTest from "./pages/ComponentTest.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/ride-accepted" element={<RideAccepted />} />
      <Route path="/component-test" element={<ComponentTest />} />
    </Routes>
  );
}
