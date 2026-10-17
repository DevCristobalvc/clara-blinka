import { OrbitApp } from "@/components/OrbitApp";
import { loadDataset } from "@/lib/dataset";

export default async function Home() {
  const { company, samples, today } = await loadDataset();
  return <OrbitApp company={company} samples={samples} today={today} />;
}
