import { LogOut } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type Props = {
  onConfirm: () => void;
  className?: string;
  variant?: "sidebar" | "compact";
  label?: string;
};

const LogoutButton = ({ onConfirm, className, variant = "sidebar", label = "Logout" }: Props) => {
  const baseClass =
    variant === "sidebar"
      ? "mt-3 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
      : "flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted";

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button className={className ?? baseClass}>
          <LogOut className="h-3.5 w-3.5" /> {label}
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Log out of ARKE?</AlertDialogTitle>
          <AlertDialogDescription>
            You'll need to sign in again to access your dashboard, courses, and progress.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Yes, log out
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default LogoutButton;
