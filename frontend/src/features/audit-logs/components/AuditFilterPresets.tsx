import styles from "./AuditFilterPresets.module.css";

export type PresetKey = "all" | "admin_only" | "work_orders" | "categories" | "team" | "logins";

interface AuditFilterPresetsProps {
  currentPreset: PresetKey;
  onSelectPreset: (preset: PresetKey) => void;
}

const PRESETS: Array<{ key: PresetKey; label: string }> = [
  { key: "all", label: "All Activity" },
  { key: "admin_only", label: "👤 Admin Operations Only" },
  { key: "work_orders", label: "📋 Work Orders" },
  { key: "categories", label: "🏷️ Categories" },
  { key: "team", label: "👥 Admin Team" },
  { key: "logins", label: "🔑 Sign-ins" },
];

export function AuditFilterPresets({ currentPreset, onSelectPreset }: AuditFilterPresetsProps) {
  return (
    <div className={styles.presetsBar} role="tablist" aria-label="Audit presets">
      {PRESETS.map((preset) => (
        <button
          key={preset.key}
          type="button"
          role="tab"
          aria-selected={currentPreset === preset.key}
          className={`${styles.presetBtn} ${
            currentPreset === preset.key ? styles.presetActive : ""
          }`}
          onClick={() => onSelectPreset(preset.key)}
        >
          {preset.label}
        </button>
      ))}
    </div>
  );
}
