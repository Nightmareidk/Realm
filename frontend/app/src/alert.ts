import type { SheetSpec } from "./sheet";

/**
 * `Alert.alert`, drawn as the app's own sheet. The system alert holds only three buttons on
 * Android and shows nothing at all in the browser preview, so every message and question goes
 * through here: the same call, `alert(title, message, buttons)`.
 */
export interface AlertButton {
  text: string;
  style?: "default" | "cancel" | "destructive";
  onPress?: () => void;
}

let open: ((spec: SheetSpec) => void) | null = null;

/** The sheet registers itself here when it mounts. */
export function bindAlert(fn: ((spec: SheetSpec) => void) | null) {
  open = fn;
}

export function alert(title: string, message?: string, buttons: AlertButton[] = []) {
  const cancel = buttons.find((b) => b.style === "cancel");
  const choices = buttons.filter((b) => b.style !== "cancel");
  if (!open) return;
  open({
    title,
    line: message,
    // A plain message closes with "OK"; a question's way out is its cancel button.
    cancelLabel: cancel?.text ?? (choices.length ? "Cancel" : "OK"),
    onCancel: cancel?.onPress,
    actions: choices.map((b) => ({
      label: b.text,
      danger: b.style === "destructive",
      onPress: () => b.onPress?.(),
    })),
  });
}
