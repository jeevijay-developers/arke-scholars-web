import { useEffect, useRef } from "react";

interface Props {
  smiles: string;
  width?: number;
  height?: number;
}

// Renders a SMILES string to a 2D canvas using smiles-drawer.
// Falls back to a plain error badge if parsing fails or the library isn't ready.
const MoleculeViewer = ({ smiles, width = 320, height = 220 }: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!smiles || !canvasRef.current) return;

    let cancelled = false;

    import("smiles-drawer/dist/smiles-drawer.js")
      .then((mod) => {
        if (cancelled) return;

        const SmilesDrawer = mod.default ?? mod;
        const drawer = new SmilesDrawer.Drawer({ width, height });

        SmilesDrawer.parse(
          smiles,
          (tree: unknown) => {
            if (cancelled || !canvasRef.current) return;
            drawer.draw(tree, canvasRef.current, "light", false);
            if (errorRef.current) errorRef.current.style.display = "none";
          },
          (err: unknown) => {
            console.warn("smiles-drawer parse error:", err);
            if (errorRef.current) errorRef.current.style.display = "flex";
          },
        );
      })
      .catch((e) => {
        console.warn("smiles-drawer load error:", e);
        if (errorRef.current) errorRef.current.style.display = "flex";
      });

    return () => { cancelled = true; };
  }, [smiles, width, height]);

  return (
    <div style={{ width, height }} className="relative">
      <canvas ref={canvasRef} width={width} height={height} className="rounded" />
      <div
        ref={errorRef}
        style={{ display: "none" }}
        className="absolute inset-0 flex items-center justify-center rounded bg-muted text-xs text-muted-foreground"
      >
        Could not render structure
      </div>
    </div>
  );
};

export default MoleculeViewer;
