import { useState, type FormEvent } from "react";
import { ConfirmDialog, EmptyState, ErrorBanner, LoadingState } from "../../components";
import {
  useArchiveCategoryMutation,
  useCategoriesQuery,
  useCreateCategoryMutation,
} from "./hooks/useCategories";
import styles from "./CategoryManagementView.module.css";

export function CategoryManagementView() {
  const categories = useCategoriesQuery();
  const create = useCreateCategoryMutation();
  const archive = useArchiveCategoryMutation();

  const [name, setName] = useState("");
  const [categoryToArchive, setCategoryToArchive] = useState<{ id: number; name: string } | null>(null);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed) {
      create.mutate(trimmed, {
        onSuccess: () => setName(""),
      });
    }
  }

  const categoryList = categories.data || [];

  return (
    <main className="page stack">
      <div>
        <h1>Checklist categories</h1>
        <p className={styles.note}>Manage the active options used on new work orders.</p>
      </div>

      <section className="card stack">
        <h2>Add category</h2>
        <form className={styles.addForm} onSubmit={handleSubmit}>
          <input
            className="input"
            value={name}
            placeholder="Category name"
            maxLength={128}
            onChange={(e) => setName(e.target.value)}
          />
          <button className="btn btn-primary" type="submit" disabled={create.isPending || !name.trim()}>
            {create.isPending ? "Adding…" : "Add category"}
          </button>
        </form>
        <ErrorBanner error={create.error} />
      </section>

      <section className="card stack">
        <div>
          <h2>Active categories</h2>
          <p className={styles.note}>Archiving removes an option from future work orders but preserves old records.</p>
        </div>
        <ErrorBanner error={categories.error} />
        <ErrorBanner error={archive.error} />

        {categories.isLoading ? (
          <LoadingState message="Loading categories…" minHeight="140px" />
        ) : null}

        {!categories.isLoading && categoryList.length > 0 ? (
          <div className={styles.categoryList}>
            {categoryList.map((category) => (
              <div className={styles.categoryRow} key={category.id}>
                <span className={styles.categoryName}>{category.name}</span>
                <button
                  className="btn btn-danger"
                  type="button"
                  disabled={archive.isPending}
                  aria-label={`Archive ${category.name}`}
                  onClick={() => setCategoryToArchive(category)}
                >
                  {archive.isPending && archive.variables === category.id ? "Archiving…" : "Archive"}
                </button>
              </div>
            ))}
          </div>
        ) : null}

        {!categories.isLoading && categoryList.length === 0 ? (
          <EmptyState
            title="No active categories yet"
            description="Add your first maintenance checklist category above to use on work orders."
          />
        ) : null}
      </section>

      <ConfirmDialog
        open={categoryToArchive !== null}
        title="Archive category?"
        message={
          categoryToArchive
            ? `“${categoryToArchive.name}” will disappear from new work orders. Existing work orders will keep it.`
            : ""
        }
        confirmLabel="Archive category"
        danger
        busy={archive.isPending}
        onCancel={() => setCategoryToArchive(null)}
        onConfirm={() => {
          if (!categoryToArchive) return;
          archive.mutate(categoryToArchive.id, { onSuccess: () => setCategoryToArchive(null) });
        }}
      />
    </main>
  );
}
