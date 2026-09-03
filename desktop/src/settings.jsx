import { createRoot } from "react-dom/client";
import { initTheme } from "./hooks/useTheme";
import SettingsView from "./views/SettingsView";
import "./index.css";

initTheme();

const container = document.getElementById("root");
const root = createRoot(container);
root.render(<SettingsView />);
