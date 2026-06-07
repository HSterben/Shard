import { createRoot } from "react-dom/client";
import ManageSubscriptionView from "./views/ManageSubscriptionView";
import "./index.css";

const container = document.getElementById("root");
const root = createRoot(container);
root.render(<ManageSubscriptionView />);
