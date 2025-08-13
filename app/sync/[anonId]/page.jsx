import SyncClient from "./SyncClient";

export default function SyncPage({ params }) {
  const { anonId } = params;
  return <SyncClient anonId={anonId} />;
}
