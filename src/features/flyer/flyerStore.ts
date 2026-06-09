import { create } from 'zustand';

export type FlyerType = 'event' | 'service' | 'product';
export type SizeKey = 'square' | 'portrait' | 'story';

export interface TextNode {
  id: string;
  field: string;        // which field it came from
  text: string;
  x: number; y: number; // position on canvas
  fontFamily: string;
  fontSize: number;
  fill: string;         // color
  width: number;        // for wrapping/resize
  // ── Text legibility ──
  shadowEnabled: boolean;     // default true
  shadowColor: string;        // default '#000000'
  shadowBlur: number;         // default 6
  shadowOpacity: number;      // default 0.6
  highlightEnabled: boolean;  // default false
  highlightColor: string;     // default '#000000'
  highlightOpacity: number;   // default 0.5
}

export interface FlyerState {
  type: FlyerType | null;
  size: SizeKey;
  fields: Record<string, string>;
  textNodes: TextNode[];
  bgImageUrl: string | null;
  selectedNodeId: string | null;
}

export interface FlyerActions {
  setType: (type: FlyerType | null) => void;
  setSize: (size: SizeKey) => void;
  setField: (key: string, value: string) => void;
  setTextNodes: (nodes: TextNode[]) => void;
  updateNode: (id: string, partial: Partial<TextNode>) => void;
  selectNode: (id: string | null) => void;
  setBgImageUrl: (url: string | null) => void;
  reset: () => void;
}

export type FlyerStore = FlyerState & FlyerActions;

const initialState: FlyerState = {
  type: null,
  size: 'square',
  fields: {},
  textNodes: [],
  bgImageUrl: null,
  selectedNodeId: null,
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
  selectNode: (id) => set({ selectedNodeId: id }),
  setBgImageUrl: (url) => set({ bgImageUrl: url }),
  reset: () => set(initialState),
}));
