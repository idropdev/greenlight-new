import { create } from 'zustand';

export type FlyerType = 'event' | 'service' | 'product' | 'sale' | 'realEstate' | 'hiring';
export type SizeKey = 'square' | 'portrait' | 'story' | 'landscape';

export interface TextNode {
  id: string;
  field: string;        // which field it came from
  text: string;
  x: number; y: number; // position on canvas
  fontFamily: string;
  fontSize: number;
  fill: string;         // color
  width: number;        // for wrapping/resize
  align: 'left' | 'center' | 'right';
  autoWidth?: boolean;  // whether width hugs the text automatically
  // ── Text legibility ──
  shadowEnabled: boolean;     // default true
  shadowColor: string;        // default '#000000'
  shadowBlur: number;         // default 6
  shadowOpacity: number;      // default 0.6
  highlightEnabled: boolean;  // default false
  highlightColor: string;     // default '#000000'
  highlightOpacity: number;   // default 0.5
}

export interface ImageNode {
  id: string;
  url: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FlyerState {
  type: FlyerType | null;
  size: SizeKey;
  fields: Record<string, string>;
  textNodes: TextNode[];
  bgImageUrl: string | null;
  selectedNodeId: string | null;
  selectedNodeIds: string[];
  imageNodes: ImageNode[];
}

export interface FlyerActions {
  setType: (type: FlyerType | null) => void;
  setSize: (size: SizeKey) => void;
  setField: (key: string, value: string) => void;
  setTextNodes: (nodes: TextNode[]) => void;
  updateNode: (id: string, partial: Partial<TextNode>) => void;
  addImageNode: (node: ImageNode) => void;
  updateImageNode: (id: string, partial: Partial<ImageNode>) => void;
  removeImageNode: (id: string) => void;
  selectNode: (id: string | null) => void;
  selectNodes: (ids: string[]) => void;
  setBgImageUrl: (url: string | null) => void;
  reset: () => void;
}

export type FlyerStore = FlyerState & FlyerActions;

const initialState: FlyerState = {
  type: 'event',
  size: 'square',
  fields: {},
  textNodes: [],
  bgImageUrl: null,
  selectedNodeId: null,
  selectedNodeIds: [],
  imageNodes: [],
};

export const useFlyerStore = create<FlyerStore>((set) => ({
  ...initialState,

  setType: (type) => set({ type }),
  setSize: (size) => set({ size }),
  setField: (key, value) =>
    set((state) => ({
      fields: {
        ...state.fields,
        [key]: value,
      },
    })),
  setTextNodes: (nodes) => set({ textNodes: nodes }),
  updateNode: (id, partial) =>
    set((state) => ({
      textNodes: state.textNodes.map((node) =>
        node.id === id ? { ...node, ...partial } : node
      ),
    })),
  addImageNode: (node) =>
    set((state) => ({
      imageNodes: [...state.imageNodes, node],
      selectedNodeId: node.id,
      selectedNodeIds: [],
    })),
  updateImageNode: (id, partial) =>
    set((state) => ({
      imageNodes: state.imageNodes.map((node) =>
        node.id === id ? { ...node, ...partial } : node
      ),
    })),
  removeImageNode: (id) =>
    set((state) => ({
      imageNodes: state.imageNodes.filter((node) => node.id !== id),
      selectedNodeId: state.selectedNodeId === id ? null : state.selectedNodeId,
      selectedNodeIds: state.selectedNodeId === id ? [] : state.selectedNodeIds,
    })),
  selectNode: (id) => set({ selectedNodeId: id, selectedNodeIds: id ? [id] : [] }),
  selectNodes: (ids) => set({ selectedNodeIds: ids, selectedNodeId: ids.length > 0 ? ids[ids.length - 1] : null }),
  setBgImageUrl: (url) => set({ bgImageUrl: url }),
  reset: () => set(initialState),
}));
