import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { createWorkOrder, listCategories } from "../api/endpoints";
import { type Priority, type WorkOrderItemCreate } from "../api/types";
import { BottomActionBar } from "../components/BottomActionBar/BottomActionBar";
import { ErrorBanner } from "../components/ErrorBanner/ErrorBanner";
import { queryKeys } from "../lib/queryKeys";
import { shareOrCopy, workerLink } from "../lib/share";
import { useToast } from "../hooks/useToast";
import styles from "./NewWorkOrderPage.module.css";

type Row = WorkOrderItemCreate & { key: string };

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function NewWorkOrderPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const cats = useQuery({ queryKey: queryKeys.categories, queryFn: listCategories });
  const [items, setItems] = useState<Row[]>([
    { key: "1", category: "", details: "" },
  ]);
  const [createdToken, setCreatedToken] = useState<string | null>(null);

  const options = useMemo(() => {
    return (cats.data || []).map((category) => category.name);
  }, [cats.data]);

  useEffect(() => {
    setItems((prev) =>
      prev.map((row) =>
        options.includes(row.category) ? row : { ...row, category: options[0] || "" },
      ),
    );
  }, [options]);

  const mutation = useMutation({
    mutationFn: createWorkOrder,
    onSuccess: async (wo) => {
      await qc.invalidateQueries({ queryKey: ["work-orders"] });
      if (wo.worker_access_token) {
        setCreatedToken(wo.worker_access_token);
      }
    },
  });

  function addItem() {
    setItems((prev) => [...prev, { key: String(Date.now()), category: options[0] || "", details: "" }]);
  }

  async function onSubmit(e?: FormEvent) {
    e?.preventDefault();
    const form = document.getElementById("wo-create") as HTMLFormElement | null;
    if (!form) return;
    const fd = new FormData(form);
    mutation.mutate({
      assigned_to_name: String(fd.get("assigned_to_name") || ""),
      assigned_to_phone: String(fd.get("assigned_to_phone") || ""),
      date_assigned: today(),
      service_address: String(fd.get("service_address") || ""),
      tenant_names: String(fd.get("tenant_names") || ""),
      tenant_phone: String(fd.get("tenant_phone") || "") || null,
      priority: String(fd.get("priority") || "standard") as Priority,
      items: items.map(({ category, details }) => ({ category, details })),
    });
  }

  if (createdToken) {
    const link = workerLink(createdToken);
    return (
      <main className="page stack">
        <div className={styles.hero}>
          <h1>Technician link</h1>
          <p>Send this secure link to the assigned technician. It opens the work order directly and does not require a login.</p>
        </div>
        <div className={styles.linkCard}>
          <span className={styles.label}>Secure link</span>
          <div className={styles.share}>{link}</div>
        </div>
        <div className={styles.actions}>
          <button
            type="button"
            className="btn"
            onClick={async () => {
              await navigator.clipboard.writeText(link);
              toast("Copied link");
            }}
          >
            Copy link
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={async () => {
              try {
                const how = await shareOrCopy(link);
                toast(how === "shared" ? "Share sheet opened" : "Copied link");
              } catch {
                /* user cancelled share */
              }
            }}
          >
            Share link
          </button>
        </div>
        <BottomActionBar>
          <Link className="btn btn-primary" to="/dashboard">
            Back to dashboard
          </Link>
        </BottomActionBar>
      </main>
    );
  }

  return (
    <main className="page">
      <form id="wo-create" className="stack" onSubmit={onSubmit}>
        <h1>New work order</h1>
        <ErrorBanner error={mutation.error} />
        <ErrorBanner error={cats.error} />
        <div className="card stack">
          <div className={styles.formSection}>
            <h2>Assignment</h2>
            <div className="grid-2">
              <label className="field">
                <span>Technician name</span>
                <input className="input" name="assigned_to_name" required />
              </label>
              <label className="field">
                <span>Technician phone</span>
                <input className="input" name="assigned_to_phone" required />
              </label>
            </div>
          </div>
          <div className={styles.formSection}>
            <h2>Property</h2>
            <div className="grid-2">
              <label className="field">
                <span>Property address</span>
                <input className="input" name="service_address" required />
              </label>
              <label className="field">
                <span>Priority</span>
                <select className="select" name="priority" defaultValue="standard">
                  <option value="emergency">Emergency (4h)</option>
                  <option value="urgent">Urgent (24h)</option>
                  <option value="standard">Standard (72h)</option>
                </select>
              </label>
            </div>
          </div>
          <div className={styles.formSection}>
            <h2>Tenant</h2>
            <div className="grid-2">
              <label className="field">
                <span>Tenant name(s)</span>
                <input className="input" name="tenant_names" required />
              </label>
              <label className="field">
                <span>Tenant phone</span>
                <input className="input" name="tenant_phone" />
              </label>
            </div>
          </div>
        </div>
        <div className="card stack">
          <div className={styles.sectionHeading}>
            <h2>Work items</h2>
            <Link className="btn" to="/settings/categories">Manage categories</Link>
          </div>
          {items.map((row) => (
            <div className={styles.item} key={row.key}>
              <label className="field">
                <span>Category</span>
                <select
                  className="select"
                  value={row.category}
                  onChange={(e) =>
                    setItems((prev) => prev.map((r) => (r.key === row.key ? { ...r, category: e.target.value } : r)))
                  }
                >
                  {options.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Details</span>
                <input
                  className="input"
                  value={row.details}
                  onChange={(e) =>
                    setItems((prev) => prev.map((r) => (r.key === row.key ? { ...r, details: e.target.value } : r)))
                  }
                />
              </label>
              <button
                type="button"
                className="btn"
                disabled={items.length === 1}
                onClick={() => setItems((prev) => prev.filter((r) => r.key !== row.key))}
              >
                Remove
              </button>
            </div>
          ))}
          <button type="button" className="btn" onClick={() => addItem()}>
            Add item
          </button>
        </div>
      </form>
      <BottomActionBar>
        <button type="button" className="btn btn-primary" disabled={mutation.isPending || options.length === 0} onClick={() => void onSubmit()}>
          {mutation.isPending ? "Creating…" : "Create work order"}
        </button>
      </BottomActionBar>
    </main>
  );
}
