import { IDataState, IUpload } from '@/interfaces/editor';
import { create } from 'zustand';

interface IDataStateExtended extends IDataState {
  uploads: IUpload[];
  setUploads: (uploads: IUpload[]) => void;
  addUpload: (upload: IUpload) => void;
  removeUpload: (uploadId: string) => void;
}

const useDataState = create<IDataStateExtended>((set) => ({
  fonts: [],
  compactFonts: [],
  uploads: [],
  setFonts: (fonts) => set({ fonts }),
  setCompactFonts: (compactFonts) => set({ compactFonts }),
  setUploads: (uploads) => set({ uploads }),
  addUpload: (upload) => set((state) => ({ uploads: [...state.uploads, upload] })),
  removeUpload: (uploadId) => set((state) => ({
    uploads: state.uploads.filter(upload => upload.id !== uploadId)
  })),
}));

export default useDataState;
