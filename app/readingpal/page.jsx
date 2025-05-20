import { Suspense } from "react";
import ReadingPalClient from "./ReadingPalClient";

export default function ReadingPalPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ReadingPalClient />
    </Suspense>
  );
}
