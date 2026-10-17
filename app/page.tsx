import { ClaraApp } from "@/components/ClaraApp";
import { loadDataset } from "@/lib/dataset";

export default async function Home() {
  const { company, samples, today } = await loadDataset();
  return <ClaraApp company={company} samples={samples} today={today} />;
}
