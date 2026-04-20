import React, { useState, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  pageSizeOptions?: number[];
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  className?: string;
}

export function Pagination({
  page,
  pageSize,
  total,
  pageSizeOptions = [10, 20, 30],
  onPageChange,
  onPageSizeChange,
  className,
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const [jumpInput, setJumpInput] = useState(String(page));
  const [sizeOpen, setSizeOpen] = useState(false);
  const sizeRef = useRef<HTMLDivElement>(null);

  // 同步外部 `page` prop 到 `jumpInput` 本地状态：
  // 参考 React 官方 "adjusting state while rendering" 模式，避免在 useEffect 中 setState。
  const [trackedPage, setTrackedPage] = useState(page);
  if (page !== trackedPage) {
    setTrackedPage(page);
    setJumpInput(String(page));
  }

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (sizeRef.current && !sizeRef.current.contains(e.target as Node)) {
        setSizeOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const commitJump = () => {
    const n = Math.min(Math.max(1, parseInt(jumpInput, 10) || 1), totalPages);
    setJumpInput(String(n));
    if (n !== page) onPageChange(n);
  };

  const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1)
    .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
    .reduce<(number | "dot")[]>((acc, p, idx, arr) => {
      if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("dot");
      acc.push(p);
      return acc;
    }, []);

  return (
    <div className={cn("flex items-center justify-between gap-4", className)}>
      {/* Left: page buttons */}
      <div className="flex items-center gap-0.5">
        <PageBtn disabled={page <= 1} onClick={() => onPageChange(page - 1)} aria-label="Previous">
          <ChevronLeft className="h-3.5 w-3.5" />
        </PageBtn>

        {pageNumbers.map((item, idx) =>
          item === "dot" ? (
            <span
              key={`d-${idx}`}
              className="w-8 text-center text-xs text-muted-foreground select-none leading-8"
            >
              ···
            </span>
          ) : (
            <PageBtn key={item} active={item === page} onClick={() => onPageChange(item)}>
              {item}
            </PageBtn>
          ),
        )}

        <PageBtn
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          aria-label="Next"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </PageBtn>
      </div>

      {/* Right: size selector + jump */}
      <div className="flex items-center gap-3">
        {/* Page size dropdown */}
        {onPageSizeChange && (
          <div ref={sizeRef} className="relative">
            <button
              className="flex items-center gap-1 h-8 px-2.5 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-accent/40 transition-colors"
              onClick={() => setSizeOpen((v) => !v)}
            >
              {pageSize}条/页
              <ChevronDown
                className={cn(
                  "h-3 w-3 transition-transform duration-150",
                  sizeOpen && "rotate-180",
                )}
              />
            </button>
            {sizeOpen && (
              <div className="absolute bottom-full mb-1 left-0 min-w-full rounded-lg border border-border bg-popover shadow-lg py-1 z-50 animate-in fade-in-0 zoom-in-95 duration-100">
                {pageSizeOptions.map((s) => (
                  <button
                    key={s}
                    className={cn(
                      "w-full px-3 py-1.5 text-xs text-left transition-colors",
                      s === pageSize
                        ? "text-primary font-medium bg-accent/50"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent/40",
                    )}
                    onClick={() => {
                      onPageSizeChange(s);
                      setSizeOpen(false);
                    }}
                  >
                    {s}条/页
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Page jump */}
        {totalPages > 1 && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">跳至</span>
            <input
              type="text"
              inputMode="numeric"
              className="w-12 h-8 rounded-lg border border-border bg-transparent text-center text-xs font-medium focus:outline-none focus:ring-2 focus:ring-ring/40 transition-shadow"
              value={jumpInput}
              onChange={(e) => setJumpInput(e.target.value.replace(/\D/g, ""))}
              onKeyDown={(e) => e.key === "Enter" && commitJump()}
              onBlur={commitJump}
            />
            <span className="text-xs text-muted-foreground">页</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Internal page button ──

function PageBtn({
  active,
  disabled,
  children,
  onClick,
  ...rest
}: {
  active?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex items-center justify-center h-8 min-w-[2rem] px-1.5 rounded-lg text-xs font-medium transition-all duration-150",
        active
          ? "border border-primary/60 text-primary bg-primary/5"
          : "text-muted-foreground hover:text-foreground hover:bg-accent/50",
        disabled && "opacity-40 pointer-events-none",
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
