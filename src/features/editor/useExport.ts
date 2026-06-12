import { useState } from 'react';
import type Konva from 'konva';
import { useFlyerStore } from '../flyer/flyerStore';
import { getDimensionsForSize } from '../flyer/sizes';

export function useExport(
  stageRef: React.RefObject<Konva.Stage | null>,
  transformerRef: React.RefObject<Konva.Transformer | null>,
  imageTransformerRef?: React.RefObject<Konva.Transformer | null>
) {
  const type = useFlyerStore((state) => state.type);
  const size = useFlyerStore((state) => state.size);
  const selectNode = useFlyerStore((state) => state.selectNode);
  const [isExporting, setIsExporting] = useState(false);

  const generatePreviewUrl = async (): Promise<string | null> => {
    const stage = stageRef.current;
    if (!stage) return null;

    // Record current selection to restore it later
    const prevSelectedNodeId = useFlyerStore.getState().selectedNodeId;
    const prevSelectedNodeIds = useFlyerStore.getState().selectedNodeIds;

    try {
      // 1. Deselect the active node in state
      selectNode(null);

      // 2. Clear Transformer nodes and redraw the layer so they don't appear in the output
      if (transformerRef.current) {
        transformerRef.current.nodes([]);
        transformerRef.current.getLayer()?.draw();
      }
      if (imageTransformerRef?.current) {
        imageTransformerRef.current.nodes([]);
        imageTransformerRef.current.getLayer()?.draw();
      }

      // 3. Force synchronous stage redraw
      stage.draw();

      // Give React/Konva a frame/tick to update selection display
      await new Promise((resolve) => setTimeout(resolve, 50));

      // 4. Calculate pixelRatio to scale back to 1:1 true pixels
      const dimensions = getDimensionsForSize(size);
      const trueWidth = dimensions.width;
      const displayedStageWidth = stage.width();
      const pixelRatio = trueWidth / displayedStageWidth;

      // 5. Generate PNG data URL
      const dataUrl = stage.toDataURL({
        pixelRatio,
        mimeType: 'image/png',
      });

      return dataUrl;
    } catch (error) {
      console.error('Error generating preview URL:', error);
      return null;
    } finally {
      // 6. Restore original selection state
      if (prevSelectedNodeIds.length > 0) {
        useFlyerStore.setState({
          selectedNodeId: prevSelectedNodeId,
          selectedNodeIds: prevSelectedNodeIds,
        });
      }
    }
  };

  const exportFlyer = async () => {
    setIsExporting(true);

    try {
      const dataUrl = await generatePreviewUrl();
      if (!dataUrl) return;

      // 6. Trigger download
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `flyer-${type || 'design'}-${size}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error exporting flyer:', error);
    } finally {
      setIsExporting(false);
    }
  };

  return {
    exportFlyer,
    isExporting,
    generatePreviewUrl,
  };
}

