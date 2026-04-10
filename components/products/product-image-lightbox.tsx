"use client";

import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ProductImageRow } from "@/lib/types";

export type LightboxState = {
  images: ProductImageRow[];
  name: string;
  index: number;
} | null;

interface ProductImageLightboxProps {
  state: LightboxState;
  onClose: () => void;
  onChange: (state: LightboxState) => void;
}

export function ProductImageLightbox({ state, onClose, onChange }: ProductImageLightboxProps) {
  return (
    <Dialog open={!!state} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-md p-2 sm:p-4">
        <DialogTitle className="sr-only">{state?.name}</DialogTitle>
        {state && (
          <div className="relative">
            <Image
              src={state.images[state.index].url}
              alt={state.name}
              width={400}
              height={400}
              className="w-full h-auto rounded-md object-contain"
            />
            {state.images.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => onChange({
                    ...state,
                    index: (state.index - 1 + state.images.length) % state.images.length,
                  })}
                  className="absolute left-1 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-1.5 text-white hover:bg-black/70 transition-colors"
                >
                  <ChevronLeft className="size-5" />
                </button>
                <button
                  type="button"
                  onClick={() => onChange({
                    ...state,
                    index: (state.index + 1) % state.images.length,
                  })}
                  className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-1.5 text-white hover:bg-black/70 transition-colors"
                >
                  <ChevronRight className="size-5" />
                </button>
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-2.5 py-0.5 text-xs text-white">
                  {state.index + 1} / {state.images.length}
                </div>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
