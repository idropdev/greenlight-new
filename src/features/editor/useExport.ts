import { useState } from 'react';
import Konva from 'konva';
import { useFlyerStore } from '../flyer/flyerStore';
import { getDimensionsForSize } from '../flyer/sizes';
import { trackEvent } from '../../lib/analytics';

export function useExport(
  stageRef: React.RefObject<Konva.Stage | null>,
  transformerRef: React.RefObject<Konva.Transformer | null>,
  imageTransformerRef?: React.RefObject<Konva.Transformer | null>
) {
  const type = useFlyerStore((state) => state.type);
  const size = useFlyerStore((state) => state.size);
  const selectNode = useFlyerStore((state) => state.selectNode);
  const [isExporting, setIsExporting] = useState(false);

  const generatePreviewUrl = async (
    targetWidthOrMultiplier: number = 1,
    format: 'png' | 'jpeg' = 'png'
  ): Promise<string | null> => {
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

      const dimensions = getDimensionsForSize(size);
      const trueWidth = dimensions.width;
      const displayedStageWidth = stage.width();
      
      let targetWidth = targetWidthOrMultiplier;
      if (targetWidthOrMultiplier <= 10) {
        targetWidth = trueWidth * targetWidthOrMultiplier;
      }
      
      const pixelRatio = targetWidth / displayedStageWidth;

      // For JPEG, set a white background fill before export so transparency doesn't render black, and restore after.
      let whiteBgRect: Konva.Rect | null = null;
      const layers = stage.getLayers();
      if (format === 'jpeg' && layers.length > 0) {
        const firstLayer = layers[0];
        whiteBgRect = new Konva.Rect({
          x: 0,
          y: 0,
          width: dimensions.width,
          height: dimensions.height,
          fill: '#ffffff',
        });
        firstLayer.add(whiteBgRect);
        whiteBgRect.moveToBottom();
        firstLayer.draw();
      }

      // 3. Force synchronous stage redraw
      stage.draw();

      // Give React/Konva a frame/tick to update selection display
      await new Promise((resolve) => setTimeout(resolve, 50));

      // 5. Generate data URL
      const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png';
      const dataUrl = stage.toDataURL({
        pixelRatio,
        mimeType,
      });

      // Restore white bg rect if added
      if (whiteBgRect) {
        whiteBgRect.destroy();
        layers[0].draw();
        stage.draw();
      }

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

  const exportFlyer = async (
    targetWidth: number,
    targetHeight: number,
    format: 'png' | 'jpeg' | 'svg'
  ) => {
    setIsExporting(true);

    try {
      let dataUrl: string | null = null;
      let downloadUrl: string | null = null;

      if (format === 'svg') {
        dataUrl = await generatePreviewUrl(targetWidth, 'png');
        if (!dataUrl) return;

        const svgString = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${targetWidth} ${targetHeight}" width="${targetWidth}" height="${targetHeight}">
  <image href="${dataUrl}" xlink:href="${dataUrl}" x="0" y="0" width="${targetWidth}" height="${targetHeight}" />
</svg>`;
        const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
        downloadUrl = URL.createObjectURL(blob);
      } else {
        dataUrl = await generatePreviewUrl(targetWidth, format);
        downloadUrl = dataUrl;
      }

      if (!downloadUrl) return;

      // Trigger download
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `flyer-${type || 'design'}-${size}-${targetWidth}x${targetHeight}.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      trackEvent('flyer_exported', {
        format,
        width: targetWidth,
        height: targetHeight,
      });

      if (format === 'svg') {
        URL.revokeObjectURL(downloadUrl);
      }
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

