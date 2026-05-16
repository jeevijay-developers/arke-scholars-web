import { ReactNode, useState, useCallback, useRef } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Variant = "destructive" | "default";

type ConfirmOptions = {
  title?: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: Variant;
};

type State = ConfirmOptions & {
  open: boolean;
  resolver?: (value: boolean) => void;
};

const DEFAULTS: Required<Omit<ConfirmOptions, "description">> & { description: ReactNode } = {
  title: "Are you sure?",
  description: "This action cannot be undone.",
  confirmLabel: "Confirm",
  cancelLabel: "Cancel",
  variant: "destructive",
};

/**
 * useConfirm — promise-based confirmation dialog.
 *
 * Usage:
 *   const { confirm, ConfirmDialog } = useConfirm();
 *   const ok = await confirm({ title: "Delete class?", description: "..." });
 *   if (!ok) return;
 *   ...
 *   return (<>{ConfirmDialog} ...</>);
 */
export function useConfirm() {
  const [state, setState] = useState<State>({ open: false });
  const stateRef = useRef(state);
  stateRef.current = state;

  const confirm = useCallback((options: ConfirmOptions = {}) => {
    return new Promise<boolean>((resolve) => {
      setState({ ...options, open: true, resolver: resolve });
    });
  }, []);

  const handleClose = (result: boolean) => {
    stateRef.current.resolver?.(result);
    setState((s) => ({ ...s, open: false, resolver: undefined }));
  };

  const merged = { ...DEFAULTS, ...state };

  const ConfirmDialog = (
    <AlertDialog
      open={state.open}
      onOpenChange={(open) => {
        if (!open) handleClose(false);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{merged.title}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div>{merged.description}</div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => handleClose(false)}>
            {merged.cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => handleClose(true)}
            className={
              merged.variant === "destructive"
                ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                : ""
            }
          >
            {merged.confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { confirm, ConfirmDialog };
}
