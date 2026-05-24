import { X } from "lucide-react";
import abuImageUrl from "../../assets/ABU.jpeg";

export function AbuRatingDialog({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#1f242166] p-4" role="presentation" onClick={onClose}>
      <div className="grid w-full max-w-[520px] gap-4 rounded-md border border-[#1f242129] bg-[#fffcf4] p-5 shadow-[0_18px_48px_rgba(31,36,33,0.22)]" role="dialog" aria-modal="true" aria-labelledby="abu-rating-title" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <h2 id="abu-rating-title" className="m-0 text-xl font-medium">A/B/U rating</h2>
          <button className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border border-[#1f242129] bg-white/45 text-[#6e716b] hover:border-[#1f24214d]" type="button" onClick={onClose} aria-label="Close A/B/U rating explanation">
            <X size={16} aria-hidden="true" />
          </button>
        </div>
        <img className="max-h-[58vh] w-full rounded-md border border-[#1f242129] bg-white object-contain" src={abuImageUrl} alt="A/B/U rating reference" />
        <p className="m-0 text-sm leading-snug text-[#1f2421]">A and B count toward the positive vote total. U counts toward the negative vote total. Rating system developed by <a className="border-b border-[#526f8d73] text-[#526f8d]" href="https://x.com/DefenderOfBasic" target="_blank" rel="noreferrer">Defender</a>.</p>
      </div>
    </div>
  );
}
