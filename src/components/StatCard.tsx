import { LucideIcon } from "lucide-react";

interface StatCardProps {
  icon: LucideIcon;
  value: string;
  label: string;
  trend?: string;
  stripeColor: "primary" | "secondary" | "accent" | "purple";
}

const stripeClasses: Record<string, string> = {
  primary: "bg-primary",
  secondary: "bg-secondary",
  accent: "bg-accent",
  purple: "bg-[hsl(271,91%,65%)]",
};

const StatCard = ({ icon: Icon, value, label, trend, stripeColor }: StatCardProps) => (
  <div className="relative overflow-hidden rounded-xl border border-border bg-card p-5 shadow-sm">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-sm font-medium text-muted-foreground font-body">{label}</p>
        <p className="mt-1 text-2xl font-black font-display text-card-foreground">{value}</p>
        {trend && (
          <p className="mt-1 text-xs font-medium text-secondary">{trend}</p>
        )}
      </div>
      <div className="rounded-lg bg-primary-light p-2">
        <Icon className="h-5 w-5 text-primary" />
      </div>
    </div>
    <div className={`absolute bottom-0 left-0 right-0 h-[3px] ${stripeClasses[stripeColor]}`} />
  </div>
);

export default StatCard;
