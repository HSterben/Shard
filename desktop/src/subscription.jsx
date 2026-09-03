import { createRoot } from "react-dom/client";
import { initTheme } from "./hooks/useTheme";
import ManageSubscriptionView from "./views/ManageSubscriptionView";
import "./index.css";

initTheme();

const container = document.getElementById("root");
const root = createRoot(container);
root.render(<ManageSubscriptionView />);
