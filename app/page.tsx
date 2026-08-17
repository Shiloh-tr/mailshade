import type { Metadata } from "next";
import { Simulator } from "./simulator";

export const metadata: Metadata = {
  title: "Unbreakmail — Local-first email QA",
  description:
    "Paste or upload email HTML, compare measured previews, and inspect cited compatibility evidence locally.",
};

export default function Home() {
  return <Simulator />;
}
