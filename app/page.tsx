import type { Metadata } from "next";
import { Simulator } from "./simulator";

export const metadata: Metadata = {
  title: "Mailshade — Email Dark Mode Simulator",
  description:
    "Paste email HTML and compare client-specific light and device-measured dark rendering. Gmail iOS is the first supported profile.",
};

export default function Home() {
  return <Simulator />;
}
