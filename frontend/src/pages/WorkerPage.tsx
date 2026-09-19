import { useParams } from "react-router-dom";
import { ErrorBanner } from "../components/ErrorBanner/ErrorBanner";
import { useWorkerQuery } from "../hooks/useWorkerQuery";
import { WorkerFlow } from "./WorkerFlow";

export function WorkerPage() {
  const { token = "" } = useParams();
  const query = useWorkerQuery(token);

  if (query.isLoading && !query.data) {
    return (
      <main className="page">
        <p>Loading ticket…</p>
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
