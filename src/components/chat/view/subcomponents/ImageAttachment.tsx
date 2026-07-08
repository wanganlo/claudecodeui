import { FileIcon } from 'lucide-react';
import { useEffect, useState } from 'react';

interface ImageAttachmentProps {
  file: File;
  onRemove: () => void;
  uploadProgress?: number;
  error?: string;
}

const isImageFile = (file: File): boolean =>
  file.type.startsWith('image/') || file.name.match(/\.(png|jpe?g|gif|webp|svg|bmp|ico)$/i) !== null;

const ImageAttachment = ({ file, onRemove, uploadProgress, error }: ImageAttachmentProps) => {
  const [preview, setPreview] = useState<string | undefined>(undefined);
  const imageFile = isImageFile(file);

  useEffect(() => {
    if (!imageFile) {
      return undefined;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file, imageFile]);

  return (
    <div className="group relative">
      {imageFile ? (
        <img src={preview} alt={file.name} className="h-20 w-20 rounded object-cover" />
      ) : (
        <div
          className="flex h-20 w-20 flex-col items-center justify-center rounded border border-border bg-muted/50 p-2 text-center"
          title={file.name}
        >
          <FileIcon className="h-8 w-8 text-muted-foreground" />
          <span className="mt-1 line-clamp-2 w-full text-[10px] text-muted-foreground">
            {file.name}
          </span>
        </div>
      )}
      {uploadProgress !== undefined && uploadProgress < 100 && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <div className="text-xs text-white">{uploadProgress}%</div>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-red-500/50">
          <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
      )}
      <button
        type="button"
        onClick={onRemove}
        className="absolute -right-2 -top-2 rounded-full bg-red-500 p-1 text-white opacity-100 transition-opacity focus:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
        aria-label="Remove attachment"
      >
        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
};

export default ImageAttachment;
