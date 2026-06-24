"use client";

// Generischer Lösch-Button: ruft eine (gebundene) Server-Action auf und
// fragt vorher per confirm() nach. Wird in Listen- und Detailansicht genutzt.
export default function DeleteButton({
  action,
  label = "Löschen",
  confirmText = "Wirklich löschen?",
  className = "btn-red",
  title,
}: {
  action: () => void | Promise<void>;
  label?: React.ReactNode;
  confirmText?: string;
  className?: string;
  title?: string;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(confirmText)) e.preventDefault();
      }}
    >
      <button type="submit" className={className} title={title}>
        {label}
      </button>
    </form>
  );
}
