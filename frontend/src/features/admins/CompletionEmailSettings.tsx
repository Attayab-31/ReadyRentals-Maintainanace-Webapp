import { useEffect, useState, type FormEvent } from "react";
import { ErrorBanner, LoadingState } from "../../components";
import {
  useCompletionEmailSettings,
  useUpdateCompletionEmailSettings,
} from "./hooks/useCompletionEmailSettings";
import styles from "./AdminManagementView.module.css";

export function CompletionEmailSettings() {
  const settingsQuery = useCompletionEmailSettings(true);
  const updateSettings = useUpdateCompletionEmailSettings();
  const [email, setEmail] = useState("");

  useEffect(() => {
    if (settingsQuery.data) {
      setEmail(settingsQuery.data.completion_email_cc ?? "");
    }
  }, [settingsQuery.data]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    updateSettings.mutate(email.trim() || null);
  }

  return (
    <section className="card stack">
      <div>
        <h2>Completion email CC</h2>
        <p className={styles.note}>
          Completed work order reports are copied to this address. Enter one address to override the
          automatic owner email recipients, or clear the field to restore them.
        </p>
      </div>

      {settingsQuery.isLoading ? <LoadingState message="Loading email settings…" minHeight="72px" /> : null}
      <ErrorBanner error={settingsQuery.error} />
      <ErrorBanner error={updateSettings.error} />

      {!settingsQuery.isLoading && !settingsQuery.isError ? (
        <>
          <form className={styles.emailSettingsForm} onSubmit={handleSubmit}>
            <label className="field">
              <span>CC email address</span>
              <input
                className="input"
                type="email"
                autoComplete="email"
                maxLength={255}
                placeholder="owner@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
            <div className={styles.emailSettingsActions}>
              <button
                className="btn btn-primary"
                type="submit"
                disabled={updateSettings.isPending || !email.trim()}
              >
                {updateSettings.isPending ? "Saving…" : "Save CC address"}
              </button>
              <button
                className="btn"
                type="button"
                disabled={updateSettings.isPending || !settingsQuery.data?.completion_email_cc}
                onClick={() => updateSettings.mutate(null)}
              >
                Restore owner email recipients
              </button>
            </div>
          </form>

          <div className={styles.effectiveCc}>
            <strong>Current CC recipients:</strong>{" "}
            {settingsQuery.data?.effective_cc_emails.length
              ? settingsQuery.data.effective_cc_emails.join(", ")
              : "None configured"}
          </div>
        </>
      ) : null}
    </section>
  );
}
