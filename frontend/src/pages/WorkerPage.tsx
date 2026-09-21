import { useParams } from "react-router-dom";
import { ErrorBanner, LoadingState } from "../components";
import { useWorkerQuery } from "../hooks/useWorkerQuery";
import { WorkerFlow } from "../features/worker";

export function WorkerPage() {
  const { token = "" } = useParams();
  const query = useWorkerQuery(token);

  if (query.isLoading && !query.data) {
    return (
      <main className="page">
        <LoadingState message="Loading ticket…" minHeight="40vh" />
      </main>
    );
  }

  if (query.error && !query.data) {
    return (
      <main className="page">
        <ErrorBanner error={query.error} />
      </main>
    );
  }

  if (!query.data) return null;
  return <WorkerFlow token={token} wo={query.data} />;
}
