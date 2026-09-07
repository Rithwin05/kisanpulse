import "./App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Decide from "./pages/Decide";
import LotPage from "./pages/LotPage";
import Pulse from "./pages/Pulse";
import Console from "./pages/Console";
import Lots from "./pages/Lots";

export default function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/decide" element={<Decide />} />
            <Route path="/lots" element={<Lots />} />
            <Route path="/lots/:id" element={<LotPage />} />
            <Route path="/pulse" element={<Pulse />} />
            <Route path="/console" element={<Console />} />
          </Routes>
        </Layout>
      </BrowserRouter>
      <Toaster theme="dark" position="top-right" toastOptions={{ style: { background: "#0f2b20", color: "#ecfdf5", border: "1px solid rgba(34,197,94,0.35)" } }} />
    </div>
  );
}
