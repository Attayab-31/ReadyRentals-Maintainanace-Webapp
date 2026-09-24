import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import type { Priority, WorkOrderItemCreate } from "../../api/types";
import { BottomActionBar, ErrorBanner } from "../../components";
import { useToast } from "../../hooks/useToast";
import { shareOrCopy, workerLink } from "../../lib/share";
import { useCategoriesQuery } from "../categories/hooks/useCategories";
import { useCreateWorkOrderMutation } from "./hooks/useWorkOrders";
import styles from "./NewWorkOrderView.module.css";

type Row = WorkOrderItemCreate & { key: string };

function today() {
  return new Date().toISOString().slice(0, 10);
}

function normalizedPhone(value: string) {
  const raw = value.trim();
  const digits = raw.replace(/\D/g, "");
  if (raw.startsWith("+") && digits.length >= 8 && digits.length <= 15) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

export function NewWorkOrderView() {
  const toast = useToast();
  const formRef = useRef<HTMLFormElement>(null);

  const cats = useCategoriesQuery();
  const [items, setItems] = useState<Row[]>([{ key: "1", category: "", details: "" }]);
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [createdTechnicianEmail, setCreatedTechnicianEmail] = useState<string | null>(null);

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

  const mutation = useCreateWorkOrderMutation((wo) => {
    if (wo.worker_access_token) {
      setCreatedToken(wo.worker_access_token);
    }
    setCreatedTechnicianEmail(wo.assigned_to_email || null);
  });

  function addItem() {
    setItems((prev) => [
      ...prev,
      { key: String(Date.now()), category: options[0] || "", details: "" },
    ]);
  }

  function handleSubmit(e?: FormEvent) {
    e?.preventDefault();
    if (!formRef.current) return;
    const technicianPhone = formRef.current.elements.namedItem("assigned_to_phone") as HTMLInputElement;
    const tenantPhone = formRef.current.elements.namedItem("tenant_phone") as HTMLInputElement;
    const normalizedTechnicianPhone = normalizedPhone(technicianPhone.value);
    const normalizedTenantPhone = normalizedPhone(tenantPhone.value);
    const phoneMessage = "Enter a 10-digit U.S. number or an international number starting with +.";
    technicianPhone.setCustomValidity(normalizedTechnicianPhone ? "" : phoneMessage);
    tenantPhone.setCustomValidity(normalizedTenantPhone ? "" : phoneMessage);
    if (!formRef.current.reportValidity()) return;
    const fd = new FormData(formRef.current);
    mutation.mutate({
      assigned_to_name: String(fd.get("assigned_to_name") || ""),
      assigned_to_phone: normalizedTechnicianPhone!,
      assigned_to_email: String(fd.get("assigned_to_email") || "").trim() || null,
      date_assigned: today(),
      service_address: String(fd.get("service_address") || ""),
      tenant_names: String(fd.get("tenant_names") || ""),
      tenant_phone: normalizedTenantPhone!,
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
          <p>
            {createdTechnicianEmail
              ? `We’ll email this secure link to ${createdTechnicianEmail}. You can also share it below.`
              : "Send this secure link to the assigned technician. It opens the work order directly and does not require a login."}
          </p>
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
      <form ref={formRef} className="stack" onSubmit={handleSubmit}>
        <h1>New work order</h1>
        <ErrorBanner error={mutation.error} />
        <ErrorBanner error={cats.error} />

        <div className="card stack">
          <p className={styles.requiredNote}>All fields marked * are required.</p>
          <div className={styles.formSection}>
            <h2>Assignment</h2>
            <div className="grid-2">
              <label className="field">
                <span className={styles.requiredLabel}>Technician name</span>
                <input className="input" name="assigned_to_name" required />
              </label>
              <label className="field">
                <span className={styles.requiredLabel}>Technician phone</span>
                <input
                  className="input"
                  name="assigned_to_phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="(555) 555-0123"
                  onInput={(e) => e.currentTarget.setCustomValidity("")}
                  required
                />
                <small className={styles.phoneHelp}>10-digit U.S. numbers are accepted; international numbers start with +.</small>
              </label>
              <label className="field">
                <span>Technician email <span className={styles.optionalLabel}>(optional)</span></span>
                <input
                  className="input"
                  name="assigned_to_email"
                  type="email"
                  autoComplete="email"
                  placeholder="technician@example.com"
                />
                <small className={styles.phoneHelp}>If provided, we’ll email the secure work order link when you create the order.</small>
              </label>
            </div>
          </div>

          <div className={styles.formSection}>
            <h2>Property</h2>
            <div className="grid-2">
              <label className="field">
                <span className={styles.requiredLabel}>Property address</span>
                <input className="input" name="service_address" required />
              </label>
              <label className="field">
                <span className={styles.requiredLabel}>Priority</span>
                <select className="select" name="priority" defaultValue="standard" required>
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
                <span className={styles.requiredLabel}>Tenant name(s)</span>
                <input className="input" name="tenant_names" required />
              </label>
              <label className="field">
                <span className={styles.requiredLabel}>Tenant phone</span>
                <input
                  className="input"
                  name="tenant_phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="(555) 555-0123"
                  onInput={(e) => e.currentTarget.setCustomValidity("")}
                  required
                />
                <small className={styles.phoneHelp}>10-digit U.S. numbers are accepted; international numbers start with +.</small>
              </label>
            </div>
          </div>
        </div>

        <div className="card stack">
          <div className={styles.sectionHeading}>
            <h2>Work items</h2>
            <Link className="btn" to="/settings/categories">
              Manage categories
            </Link>
          </div>
          {items.map((row) => (
            <div className={styles.item} key={row.key}>
              <label className="field">
                <span className={styles.requiredLabel}>Category</span>
                <select
                  className="select"
                  value={row.category}
                  required
                  onChange={(e) =>
                    setItems((prev) =>
                      prev.map((r) => (r.key === row.key ? { ...r, category: e.target.value } : r)),
                    )
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
                <span className={styles.requiredLabel}>Details</span>
                <input
                  className="input"
                  value={row.details}
                  required
                  onChange={(e) =>
                    setItems((prev) =>
                      prev.map((r) => (r.key === row.key ? { ...r, details: e.target.value } : r)),
                    )
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
          <button type="button" className="btn" onClick={addItem}>
            Add item
          </button>
        </div>
      </form>

      <BottomActionBar>
        <button
          type="button"
          className="btn btn-primary"
          disabled={mutation.isPending || options.length === 0}
          onClick={() => void handleSubmit()}
        >
          {mutation.isPending ? "Creating…" : "Create work order"}
        </button>
      </BottomActionBar>
    </main>
  );
}
