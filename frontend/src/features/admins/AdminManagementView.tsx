import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import type { AdminUser } from "../../api/types";
import { Badge, ConfirmDialog, EmptyState, ErrorBanner, LoadingState } from "../../components";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import {
  useAdminsQuery,
  useCreateAdminMutation,
  useDeleteAdminMutation,
} from "./hooks/useAdmins";
import styles from "./AdminManagementView.module.css";

export function AdminManagementView() {
  const currentUser = useCurrentUser();
  const isOwner = currentUser.data?.role === "owner";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [adminToDelete, setAdminToDelete] = useState<AdminUser | null>(null);

  const adminsQuery = useAdminsQuery(isOwner);

  const createMutation = useCreateAdminMutation(() => {
    setName("");
    setEmail("");
    setPassword("");
  });

  const deleteMutation = useDeleteAdminMutation(() => {
    setAdminToDelete(null);
  });


  function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password.trim()) return;
    createMutation.mutate({
      name: name.trim(),
      email: email.trim(),
      password: password.trim(),
    });
  }

  if (!currentUser.isLoading && !isOwner) {
    return (
      <main className="page stack">
        <h1>Access restricted</h1>
        <p className={styles.note}>
          Only the Account Owner can view and manage office administrator accounts.
        </p>
      </main>
    );
  }

  const adminsList = adminsQuery.data || [];

  return (
    <main className="page stack">
      <div>
        <h1>Admin team management</h1>
        <p className={styles.note}>
          Create and manage office admin accounts who assign and oversee property maintenance work orders.
        </p>
      </div>

      <div className={styles.ownerCallout}>
        <div>
          <div className={styles.ownerCalloutTitle}>Account Owner: {currentUser.data?.name}</div>
          <div className={styles.ownerCalloutDesc}>
            Only your master Owner account can create or remove office administrators.
          </div>
        </div>
        <Link className="btn" to="/audit-logs?actor_role=admin" style={{ fontSize: "13px" }}>
          View Admin Audit Log →
        </Link>
      </div>

      <section className="card stack">
        <h2>Add office admin</h2>
        <form className={styles.addForm} onSubmit={handleCreate}>
          <label className="field">
            <span>Admin name</span>
            <input
              className="input"
              value={name}
              placeholder="e.g. Sarah Jenkins"
              required
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="field">
            <span>Email address</span>
            <input
              className="input"
              type="email"
              value={email}
              placeholder="admin@example.com"
              required
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="field">
            <span>Password</span>
            <input
              className="input"
              type="password"
              value={password}
              placeholder="At least 6 characters"
              minLength={6}
              required
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <div className={styles.addActions}>
            <button
              className="btn btn-primary"
              type="submit"
              disabled={createMutation.isPending || !name.trim() || !email.trim() || password.length < 6}
            >
              {createMutation.isPending ? "Creating…" : "Add admin"}
            </button>
          </div>
        </form>
        <ErrorBanner error={createMutation.error} />
      </section>

      <section className="card stack">
        <div>
          <h2>Active administrators</h2>
          <p className={styles.note}>
            Admins can log in with their email and password to create, assign, and track work orders.
          </p>
        </div>

        <ErrorBanner error={adminsQuery.error} />
        <ErrorBanner error={deleteMutation.error} />

        {adminsQuery.isLoading ? (
          <LoadingState message="Loading team accounts…" minHeight="140px" />
        ) : null}

        {!adminsQuery.isLoading && adminsList.length > 0 ? (
          <>
            {/* Desktop Table View */}
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Assigned work orders</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {adminsList.map((admin) => {
                    const isSelf = admin.id === currentUser.data?.id;
                    const isUserOwner = admin.role === "owner";
                    return (
                      <tr key={admin.id}>
                        <td>
                          <span className={styles.adminName}>{admin.name}</span>
                        </td>
                        <td>
                          <span className={styles.adminEmail}>{admin.email}</span>
                        </td>
                        <td>
                          <Badge variant={isUserOwner ? "warning" : "default"}>
                            {isUserOwner ? "Owner" : "Admin"}
                          </Badge>
                        </td>
                        <td>
                          <span className={styles.ticketCount}>{admin.work_orders_count} orders</span>
                        </td>
                        <td>
                          {isSelf || isUserOwner ? (
                            <span className={styles.note}>Master account</span>
                          ) : (
                            <button
                              className="btn btn-danger"
                              type="button"
                              disabled={deleteMutation.isPending}
                              onClick={() => setAdminToDelete(admin)}
                            >
                              Delete
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View */}
            <div className={styles.mobileList}>
              {adminsList.map((admin) => {
                const isSelf = admin.id === currentUser.data?.id;
                const isUserOwner = admin.role === "owner";
                return (
                  <article className={styles.mobileCard} key={admin.id}>
                    <div className={styles.mobileCardHeader}>
                      <div>
                        <div className={styles.adminName}>{admin.name}</div>
                        <div className={styles.adminEmail}>{admin.email}</div>
                      </div>
                      <Badge variant={isUserOwner ? "warning" : "default"}>
                        {isUserOwner ? "Owner" : "Admin"}
                      </Badge>
                    </div>
                    <div className={styles.mobileCardFooter}>
                      <span className={styles.ticketCount}>{admin.work_orders_count} work orders</span>
                      {isSelf || isUserOwner ? (
                        <span className={styles.note}>Master account</span>
                      ) : (
                        <button
                          className="btn btn-danger"
                          type="button"
                          disabled={deleteMutation.isPending}
                          onClick={() => setAdminToDelete(admin)}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        ) : null}

        {!adminsQuery.isLoading && adminsList.length === 0 ? (
          <EmptyState
            title="No admin accounts found"
            description="Add office admins to assign and manage work orders."
          />
        ) : null}
      </section>

      <ConfirmDialog
        open={adminToDelete !== null}
        title={`Delete admin ${adminToDelete?.name}?`}
        message={
          adminToDelete
            ? `Are you sure you want to remove ${adminToDelete.name} (${adminToDelete.email})? Any work orders they previously assigned will be preserved and reassigned to your Owner account.`
            : ""
        }
        confirmLabel="Delete admin"
        danger
        busy={deleteMutation.isPending}
        onCancel={() => setAdminToDelete(null)}
        onConfirm={() => {
          if (!adminToDelete) return;
          deleteMutation.mutate(adminToDelete.id);
        }}
      />
    </main>
  );
}
