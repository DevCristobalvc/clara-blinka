import { Deck } from "@/components/Deck";

export const metadata = { title: "Deck · ORBIT" };

/** Pitch slides, one per `?s=` index. Used as title cards in the demo video and for the live pitch. */
export default async function DeckPage({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  const { s } = await searchParams;
  return <Deck index={Number(s ?? 0)} />;
}
