import { Suspense } from "react";
import GrammarClient from "./GrammarClient";

export default function GrammarPage() {
  return (
    <Suspense fallback={null}>
      <GrammarClient />
    </Suspense>
  );
}