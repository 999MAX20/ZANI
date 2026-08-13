import { Eye, EyeOff } from "lucide-react";

import { useI18n } from "../../lib/i18n";

type PasswordVisibilityToggleProps = {
  visible: boolean;
  onToggle: () => void;
};

export function PasswordVisibilityToggle({ visible, onToggle }: PasswordVisibilityToggleProps) {
  const { t } = useI18n();
  const label = visible ? t("auth.hidePassword") : t("auth.showPassword");
  const Icon = visible ? EyeOff : Eye;

  return (
    <button
      type="button"
      className="serenity-login__password-toggle"
      aria-label={label}
      aria-pressed={visible}
      title={label}
      onClick={onToggle}
    >
      <Icon size={18} aria-hidden="true" />
    </button>
  );
}
