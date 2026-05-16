import { ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";

interface SectionHeaderProps {
  title: string;
  viewAllLink?: string;
}

const SectionHeader = ({ title, viewAllLink }: SectionHeaderProps) => (
  <div className="flex items-center justify-between mb-4">
    <h2 className="text-lg font-bold font-display text-foreground">{title}</h2>
    {viewAllLink && (
      <Link
        to={viewAllLink}
        className="flex items-center gap-1 text-sm font-medium text-primary hover:text-primary-dark transition-colors"
      >
        View All <ChevronRight className="h-4 w-4" />
      </Link>
    )}
  </div>
);

export default SectionHeader;
