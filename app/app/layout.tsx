import { Shell } from "@/components/app/Shell";
import { WorkspaceProvider } from "@/components/app/Workspace";
import { loadDataset } from "@/lib/dataset";

/** The company's workspace. The demo dataset ships with the page; everything else comes from the API. */
export default async function AppLayout({ children }: LayoutProps<"/app">) {
  const { samples } = await loadDataset();
  return (
    <WorkspaceProvider samples={samples}>
      <Shell>{children}</Shell>
    </WorkspaceProvider>
  );
}
