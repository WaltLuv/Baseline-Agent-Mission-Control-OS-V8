import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { SetupModal } from "./setup";

function ActivateRoute() {
  const navigate = useNavigate();
  return <SetupModal onClose={() => void navigate({ to: "/" })} />;
}

export const Route = createFileRoute("/app/activate")({
  head: () => ({
    meta: [
      { title: "Activate Baseline Automations" },
      {
        name: "description",
        content: "Activate Baseline Automations and connect your local AI runtime stack.",
      },
    ],
  }),
  component: ActivateRoute,
});
