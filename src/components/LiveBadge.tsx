const LiveBadge = () => (
  <span className="inline-flex items-center gap-1.5 rounded-pill bg-destructive px-2.5 py-0.5 text-xs font-bold text-destructive-foreground">
    <span className="h-2 w-2 rounded-full bg-destructive-foreground animate-live-pulse" />
    LIVE
  </span>
);

export default LiveBadge;
