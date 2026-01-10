import SchedulingClient from "./case-studies/scheduling-time-grid/SchedulingClient";

export const metadata = {
  title: "Scheduling + Time-Grid Calendar App",
  description:
    "Week view time-grid, smart defaults, validation, and clean editing flows for appointments.",
};

export default function HomePage() {
  return <SchedulingClient />;
}
