import React, { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { User, Mail, Phone, Pencil, Check, X } from "lucide-react";
import { useUserStore } from "@mozi/store";
import { useTranslation } from "react-i18next";

interface EditableFieldProps {
  field: string;
  label: string;
  icon: React.ElementType;
  type?: string;
  value: string;
  editingField: string | null;
  localUserData: Record<string, string>;
  onEdit: (field: string) => void;
  onSave: (field: string) => void;
  onCancel: () => void;
  onChange: (field: string, value: string) => void;
  notSetLabel: string;
}

function EditableField({
  field,
  label,
  icon: Icon,
  type = "text",
  value,
  editingField,
  localUserData,
  onEdit,
  onSave,
  onCancel,
  onChange,
  notSetLabel,
}: EditableFieldProps) {
  return (
    <div className="flex items-center gap-4 py-3.5 group">
      <div className="flex items-center gap-2.5 w-28 shrink-0">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
      </div>
      <div className="flex-1 min-w-0">
        {editingField === field ? (
          <div className="flex items-center gap-3">
            <Input
              type={type}
              value={localUserData[field] ?? ""}
              onChange={(e) => onChange(field, e.target.value)}
              className="h-8 flex-1 rounded-lg text-sm"
              autoFocus
            />
            <div className="flex items-center gap-1 shrink-0">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 rounded-lg text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10"
                onClick={() => onSave(field)}
              >
                <Check className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                onClick={onCancel}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <span className="text-sm text-foreground truncate">{value || notSetLabel}</span>
            {!editingField && (
              <button
                className="p-1.5 rounded-lg text-muted-foreground/0 group-hover:text-muted-foreground hover:bg-accent transition-all duration-200"
                onClick={() => onEdit(field)}
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function UserInfoSection() {
  const { t } = useTranslation();
  const { profile: storeProfile, updateUsername, updateEmail, updatePhone } = useUserStore();

  const [editingField, setEditingField] = useState<string | null>(null);
  const [localUserData, setLocalUserData] = useState({
    username: storeProfile.username,
    email: storeProfile.email,
    phone: storeProfile.phone,
  });

  const storeUserData = useMemo(
    () => ({
      username: storeProfile.username,
      email: storeProfile.email,
      phone: storeProfile.phone,
    }),
    [storeProfile.username, storeProfile.email, storeProfile.phone],
  );
  const displayData = editingField ? localUserData : storeUserData;

  const handleEdit = (field: string) => {
    setLocalUserData({
      username: storeProfile.username,
      email: storeProfile.email,
      phone: storeProfile.phone,
    });
    setEditingField(field);
  };
  const handleSave = (field: string) => {
    if (field === "username") updateUsername(localUserData.username);
    else if (field === "email") updateEmail(localUserData.email);
    else if (field === "phone") updatePhone(localUserData.phone);
    setEditingField(null);
  };
  const handleCancel = () => {
    setLocalUserData({
      username: storeProfile.username,
      email: storeProfile.email,
      phone: storeProfile.phone,
    });
    setEditingField(null);
  };
  const handleFieldChange = (field: string, value: string) => {
    setLocalUserData((prev) => ({ ...prev, [field]: value }));
  };

  const editableFieldProps = {
    editingField,
    localUserData,
    onEdit: handleEdit,
    onSave: handleSave,
    onCancel: handleCancel,
    onChange: handleFieldChange,
    notSetLabel: t("profile.notSet"),
  };

  return (
    <section className="space-y-4 animate-fade-in-up stagger-1">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
        <User className="h-3.5 w-3.5" />
        {t("profile.userInfo")}
      </h3>
      <div className="rounded-2xl glass premium-shadow overflow-hidden">
        <div className="p-6">
          <div className="flex items-start gap-5">
            <div className="relative group">
              <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-emerald-300 via-emerald-400 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-400/30 overflow-hidden shrink-0">
                {storeProfile.avatar && storeProfile.avatar !== "user" ? (
                  <img
                    src={storeProfile.avatar}
                    alt={storeProfile.username}
                    className="h-16 w-16 object-cover"
                  />
                ) : (
                  <User className="h-7 w-7 text-white" />
                )}
              </div>
            </div>
            <div className="flex-1 min-w-0 divide-y divide-border/50">
              <EditableField
                field="username"
                label={t("profile.name")}
                icon={User}
                value={displayData.username}
                {...editableFieldProps}
              />
              <EditableField
                field="email"
                label={t("profile.email")}
                icon={Mail}
                type="email"
                value={displayData.email}
                {...editableFieldProps}
              />
              <EditableField
                field="phone"
                label={t("profile.phone")}
                icon={Phone}
                type="tel"
                value={displayData.phone}
                {...editableFieldProps}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
