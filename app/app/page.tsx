import { OrbitApp } from "@/components/OrbitApp";
import { loadDataset } from "@/lib/dataset";

export const metadata = { title: "Panel · ORBIT" };

export default async function AppPage() {
  const { company, samples, today } = await loadDataset();
  return <OrbitApp company={company} samples={samples} today={today} />;
}
