import { createRoot } from "react-dom/client";
import SettingsView from "./views/SettingsView";
import "./index.css";

const container = document.getElementById("root");
const root = createRoot(container);
root.render(<SettingsView />);
