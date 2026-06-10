import { createFileRoute, redirect } from "@tanstack/react-router";

// `/admin` used to 404 — Walt's directive: "Do not leave /admin as a dead
// route." The canonical admin surface is now the API Keys / Credentials
// manager. We redirect on load so any sidebar / bookmark hits the right
// page without us having to refactor every link.
export const Route = createFileRoute("/admin")({
  beforeLoad: () => {
    throw redirect({ to: "/settings/api-keys" });
  },
});
