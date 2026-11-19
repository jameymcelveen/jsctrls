import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createDataSet, restConnector } from "@jsctrls/react";
import { defineJcListBox } from "@jsctrls/elements";
import "@jsctrls/react/styles.css";
import "./site.css";
import { Site } from "./Site";

defineJcListBox();

const names = createDataSet<{ id: string; name: string }>({
  connector: restConnector({ baseUrl: "/api", resource: "names" }),
});

const root = document.getElementById("root");
if (!root) {
  throw new Error("Root element #root is missing");
}

createRoot(root).render(
  <StrictMode>
    <Site names={names} />
  </StrictMode>,
);
