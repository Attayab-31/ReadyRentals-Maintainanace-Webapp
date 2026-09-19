import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useState } from "react";
import { archiveCategory, createCategory, listCategories } from "../api/endpoints";
import { ConfirmDialog } from "../components/ConfirmDialog/ConfirmDialog";
import { ErrorBanner } from "../components/ErrorBanner/ErrorBanner";
import { useToast } from "../hooks/useToast";
import { queryKeys } from "../lib/queryKeys";
import styles from "./CategoryManagementPage.module.css";

export function CategoryManagementPage() {
    const toast = useToast();
    const qc = useQueryClient();
    const categories = useQuery({ queryKey: queryKeys.categories, queryFn: listCategories });
    const [name, setName] = useState("");
    const [categoryToArchive, setCategoryToArchive] = useState<{ id: number; name: string } | null>(null);

    const create = useMutation({
        mutationFn: createCategory,
        onSuccess: async () => {
            setName("");
            await qc.invalidateQueries({ queryKey: queryKeys.categories });
            toast("Category added");
        },
    });

    const archive = useMutation({
        mutationFn: archiveCategory,
        onSuccess: async () => {
            await qc.invalidateQueries({ queryKey: queryKeys.categories });
            toast("Category archived");
        },
    });

    function submit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const trimmed = name.trim();
        if (trimmed) create.mutate(trimmed);
    }

    return (
        <main className="page stack">
            <div>
                <h1>Checklist categories</h1>
                <p className={styles.note}>Manage the active options used on new work orders.</p>
            </div>

            <section className="card stack">
                <h2>Add category</h2>
                <form className={styles.addForm} onSubmit={submit}>
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
                {categories.isLoading ? <p>Loading categories...</p> : null}
                {categories.data?.length ? (
                    <div className={styles.categoryList}>
                        {categories.data.map((category) => (
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
                {categories.data?.length === 0 ? <p>No active categories yet.</p> : null}
            </section>

            <ConfirmDialog
                open={categoryToArchive !== null}
                title="Archive category?"
                message={categoryToArchive ? `“${categoryToArchive.name}” will disappear from new work orders. Existing work orders will keep it.` : ""}
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
