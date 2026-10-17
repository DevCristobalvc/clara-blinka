import { Suspense } from "react";
import { Deck } from "@/components/Deck";

export const metadata = { title: "Deck · ORBIT" };

/** Pitch slides, one per `?s=` index. Used as title cards in the demo video and for the live pitch. */
export default function DeckPage() {
  return (
    <Suspense fallback={null}>
      <Deck />
    </Suspense>
  );
}
