import { Camera, ImagePlus, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { MAX_PHOTO_BYTES, PHOTO_TYPES } from '@/lib/validation';
import { initials } from '@/lib/utils';

/**
 * Upload / preview / change / remove a photo.
 * `existingUrl` is the saved photo (edit mode); `file` is a newly chosen one.
 */
export function PhotoPicker({
  name,
  existingUrl,
  file,
  removed,
  onFile,
  onRemove,
}: {
  name: string;
  existingUrl?: string | null;
  file: File | null;
  removed: boolean;
  onFile: (f: File | null) => void;
  onRemove: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const shown = preview ?? (!removed ? existingUrl : null);

  const choose = (f: File | undefined) => {
    setError(null);
    if (!f) return;
    if (!PHOTO_TYPES.includes(f.type)) {
      setError('Please choose a JPG, JPEG, PNG or WebP image.');
      return;
    }
    if (f.size > MAX_PHOTO_BYTES) {
      setError(`This image is ${(f.size / 1024 / 1024).toFixed(1)} MB. Please choose one under 2 MB.`);
      return;
    }
    onFile(f);
  };

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
      <button
        type="button"
        onClick={() => input.current?.click()}
        className="group relative size-28 shrink-0 overflow-hidden rounded-full border-2 border-dashed border-slate-300 bg-slate-50 hover:border-primary"
        aria-label={shown ? 'Change photo' : 'Upload photo'}
      >
        {shown ? (
          <img src={shown} alt="Student photo preview" className="size-full object-cover" />
        ) : name.trim() ? (
          <span className="flex size-full items-center justify-center text-3xl font-semibold text-slate-400">{initials(name)}</span>
        ) : (
          <Camera className="mx-auto size-8 text-slate-400" />
        )}
        <span className="absolute inset-x-0 bottom-0 bg-slate-900/60 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
          {shown ? 'Change' : 'Upload'}
        </span>
      </button>
      <div className="space-y-2 text-center sm:text-left">
        <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
          <Button variant="outline" size="sm" onClick={() => input.current?.click()}>
            <ImagePlus /> {shown ? 'Change photo' : 'Upload photo'}
          </Button>
          {shown && (
            <Button
              variant="ghost"
              size="sm"
              className="text-red-600 hover:bg-red-50"
              onClick={() => {
                if (file) onFile(null);
                else onRemove();
                if (input.current) input.current.value = '';
              }}
            >
              <Trash2 /> Remove
            </Button>
          )}
        </div>
        <p className="text-xs text-slate-500">JPG, JPEG, PNG or WebP · max 2 MB</p>
        {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
      </div>
      <input
        ref={input}
        type="file"
        accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => choose(e.target.files?.[0])}
      />
    </div>
  );
}
