import { createRoot } from "react-dom/client";
import { initTheme } from "./hooks/useTheme";
import PresetsView from "./views/PresetsView";
import "./index.css";

initTheme();

const container = document.getElementById("root");
const root = createRoot(container);
root.render(<PresetsView />);
