import "./style.css";

// Core elements/buttons needed to build the paint app's layout.
interface PaintAppElements {
  root: HTMLElement;
  title: HTMLHeadingElement;
  layout: HTMLDivElement;
  toolColumn: HTMLDivElement;
  canvasContainer: HTMLDivElement;
  canvas: HTMLCanvasElement;
  clearButton: HTMLButtonElement;
  undoButton: HTMLButtonElement;
  redoButton: HTMLButtonElement;
  thinButton: HTMLButtonElement;
  thickButton: HTMLButtonElement;
  stickerButtons: HTMLButtonElement[];
}

// Basic configuration values for the UI.
const APP_TITLE = "Browser Paint Tool";
const CANVAS_SIZE = 256;
const DRAWING_CHANGED_EVENT = "drawing-changed";
const TOOL_MOVED_EVENT = "tool-moved";
const THIN_MARKER_THICKNESS = 4;
const THICK_MARKER_THICKNESS = 10;
// Sticker visuals share a consistent size and a curated set of emoji choices.
const STICKER_FONT = "32px serif";
const STICKER_OPTIONS = ["🌸", "🎈", "⭐"];

// Represent a point recorded from the user's cursor.
interface Point {
  x: number;
  y: number;
}

// Any drawable instruction that knows how to paint itself onto the canvas.
interface DrawCommand {
  display: (context: CanvasRenderingContext2D) => void;
}

// Draw commands that respond to dragging so they can be repositioned as the mouse moves.
interface DraggableCommand extends DrawCommand {
  drag: (x: number, y: number) => void;
}

// Renderable hint shown while hovering the tool, such as an outline or a ghosted sticker.
interface ToolPreview {
  draw: (context: CanvasRenderingContext2D) => void;
}

// Specialized draw command that records freehand marker strokes.
// The drag method grows the line with additional positions as the user moves.
interface MarkerLine extends DraggableCommand {}

// Collection of all recorded draw commands.
interface DrawingModel {
  commands: DraggableCommand[];
  redoStack: DraggableCommand[];
}

// Stores the current preview renderer so the UI can redraw it as the cursor moves.
interface ToolPreviewState {
  active: ToolPreview | null;
}

// Configuration for marker and sticker tools so the UI can respond to the active selection.
type MarkerTool = { type: "marker"; thickness: number };
type StickerTool = { type: "sticker"; emoji: string };
type PaintTool = MarkerTool | StickerTool;

// Factory that produces a marker line command backed by a list of recorded points.
// The returned object exposes a drag method to extend the line and a display method
// that knows how to render itself with the active canvas context state.
const createMarkerLine = (
  initialPoint: Point,
  thickness: number,
): MarkerLine => {
  const points: Point[] = [initialPoint];

  return {
    drag: (x: number, y: number): void => {
      points.push({ x, y });
    },
    display: (context: CanvasRenderingContext2D): void => {
      if (points.length === 0) return;

      // Apply per-stroke styling so each marker tool can render at its own width.
      context.save();
      context.lineWidth = thickness;
      context.lineCap = "round";
      context.strokeStyle = "#111827";

      context.beginPath();
      const [first, ...rest] = points;
      context.moveTo(first.x, first.y);
      if (rest.length === 0) {
        context.lineTo(first.x, first.y);
      } else {
        rest.forEach(({ x, y }) => {
          context.lineTo(x, y);
        });
      }
      context.stroke();
      context.closePath();

      context.restore();
    },
  };
};

// Factory for the hover preview; draws a simple outline circle matching the marker size.
const createMarkerPreview = (point: Point, thickness: number): ToolPreview => ({
  draw: (context: CanvasRenderingContext2D): void => {
    context.save();

    // A light outline shows the user how thick the next stroke will be without adding a line.
    context.strokeStyle = "#9CA3AF";
    context.lineWidth = 1;
    context.beginPath();
    context.arc(point.x, point.y, thickness / 2, 0, Math.PI * 2);
    context.stroke();

    context.restore();
  },
});

// Holds the active preview renderer so listeners can mutate it without using globals.
const createToolPreviewState = (): ToolPreviewState => ({
  active: null,
});

// Factory for sticker placement so users can drag the emoji to a final position.
const createStickerCommand = (
  emoji: string,
  point: Point,
): DraggableCommand => {
  let current = point;

  return {
    drag: (x: number, y: number): void => {
      current = { x, y };
    },
    display: (context: CanvasRenderingContext2D): void => {
      context.save();
      context.font = STICKER_FONT;
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(emoji, current.x, current.y);
      context.restore();
    },
  };
};

// Preview command that shows a ghosted sticker under the cursor before committing it.
const createStickerPreview = (emoji: string, point: Point): ToolPreview => ({
  draw: (context: CanvasRenderingContext2D): void => {
    context.save();
    context.globalAlpha = 0.65;
    context.font = STICKER_FONT;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(emoji, point.x, point.y);
    context.restore();
  },
});

// Builds the heading element that labels the program in browser.
const createTitle = (text: string): HTMLHeadingElement => {
  const heading = document.createElement("h1");
  heading.id = "app-title";
  heading.textContent = text;
  return heading;
};

// Builds the canvas element that will host the drawing surface.
const createCanvas = (size: number): HTMLCanvasElement => {
  const canvas = document.createElement("canvas");
  canvas.id = "paint-canvas";
  canvas.width = size;
  canvas.height = size;
  canvas.setAttribute("aria-label", "Drawing canvas");
  return canvas;
};

// Container that holds paint controls.
const createControls = (): {
  toolColumn: HTMLDivElement;
  actionRow: HTMLDivElement;
  clearButton: HTMLButtonElement;
  undoButton: HTMLButtonElement;
  redoButton: HTMLButtonElement;
  thinButton: HTMLButtonElement;
  thickButton: HTMLButtonElement;
  stickerButtons: HTMLButtonElement[];
} => {
  const toolColumn = document.createElement("div");
  toolColumn.id = "tool-column";

  const toolGroup = document.createElement("div");
  toolGroup.id = "tool-group";

  const thinButton = document.createElement("button");
  thinButton.id = "thin-button";
  thinButton.type = "button";
  thinButton.textContent = "Thin Marker";
  thinButton.className = "tool-button";

  const thickButton = document.createElement("button");
  thickButton.id = "thick-button";
  thickButton.type = "button";
  thickButton.textContent = "Thick Marker";
  thickButton.className = "tool-button";

  toolGroup.append(thinButton, thickButton);

  const stickerGroup = document.createElement("div");
  stickerGroup.id = "sticker-group";

  const stickerButtons = STICKER_OPTIONS.map((emoji) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "tool-button";
    button.textContent = emoji;
    button.setAttribute("aria-label", `${emoji} sticker`);
    stickerGroup.append(button);
    return button;
  });

  const clearButton = document.createElement("button");
  clearButton.id = "clear-button";
  clearButton.type = "button";
  clearButton.textContent = "Clear Canvas";

  const undoButton = document.createElement("button");
  undoButton.id = "undo-button";
  undoButton.type = "button";
  undoButton.textContent = "Undo";

  const redoButton = document.createElement("button");
  redoButton.id = "redo-button";
  redoButton.type = "button";
  redoButton.textContent = "Redo";

  const actionRow = document.createElement("div");
  actionRow.id = "action-row";
  actionRow.append(undoButton, redoButton, clearButton);

  toolColumn.append(toolGroup, stickerGroup);

  return {
    toolColumn,
    actionRow,
    clearButton,
    undoButton,
    redoButton,
    thinButton,
    thickButton,
    stickerButtons,
  };
};

// Assemble the page layout and return references to the created elements.
const initializeLayout = (): PaintAppElements => {
  const root = document.body;
  root.innerHTML = "";

  const title = createTitle(APP_TITLE);
  const canvas = createCanvas(CANVAS_SIZE);
  const {
    toolColumn,
    actionRow,
    clearButton,
    undoButton,
    redoButton,
    thinButton,
    thickButton,
    stickerButtons,
  } = createControls();

  const canvasContainer = document.createElement("div");
  canvasContainer.id = "canvas-container";
  canvasContainer.append(canvas, actionRow);

  const layout = document.createElement("div");
  layout.id = "app-layout";
  layout.append(toolColumn, canvasContainer);

  root.append(title, layout);

  return {
    root,
    title,
    layout,
    toolColumn,
    canvasContainer,
    canvas,
    clearButton,
    undoButton,
    redoButton,
    thinButton,
    thickButton,
    stickerButtons,
  };
};

// Track whether the user is currently dragging the mouse to record a stroke.
interface InteractionState {
  isDrawing: boolean;
}

// Shared tool selection state that tracks which tool is active.
interface ToolSelection {
  activeTool: PaintTool;
}

// Convert a mouse event's location to canvas-relative coordinates.
const toCanvasPoint = (
  canvas: HTMLCanvasElement,
  event: MouseEvent,
): Point => {
  const bounds = canvas.getBoundingClientRect();
  return {
    x: event.clientX - bounds.left,
    y: event.clientY - bounds.top,
  };
};

// Set up the tool buttons and return a callback that reports the current selection.
// Each button click updates the stored value, toggles visual selection, and
// notifies the canvas so previews can refresh.
const attachToolSelector = (
  canvas: HTMLCanvasElement,
  thinButton: HTMLButtonElement,
  thickButton: HTMLButtonElement,
  stickerButtons: HTMLButtonElement[],
  previewState: ToolPreviewState,
): () => PaintTool => {
  const selection: ToolSelection = {
    activeTool: { type: "marker", thickness: THIN_MARKER_THICKNESS },
  };

  const applySelectionStyles = (activeButton: HTMLButtonElement): void => {
    const buttons = [thinButton, thickButton, ...stickerButtons];
    buttons.forEach((button) => {
      const isActive = button === activeButton;
      button.classList.toggle("selected-tool", isActive);
    });
  };

  const chooseTool = (button: HTMLButtonElement, tool: PaintTool): void => {
    selection.activeTool = tool;
    previewState.active = null;
    applySelectionStyles(button);
    canvas.dispatchEvent(new Event(TOOL_MOVED_EVENT));
  };

  chooseTool(thinButton, { type: "marker", thickness: THIN_MARKER_THICKNESS });

  thinButton.addEventListener("click", () => {
    chooseTool(thinButton, {
      type: "marker",
      thickness: THIN_MARKER_THICKNESS,
    });
  });

  thickButton.addEventListener("click", () => {
    chooseTool(thickButton, {
      type: "marker",
      thickness: THICK_MARKER_THICKNESS,
    });
  });

  stickerButtons.forEach((button) => {
    button.addEventListener("click", () => {
      chooseTool(button, { type: "sticker", emoji: button.textContent ?? "" });
    });
  });

  return () => selection.activeTool;
};

// Attach mouse listeners that record points into the drawing model.
const enableDrawing = (
  canvas: HTMLCanvasElement,
  model: DrawingModel,
  getActiveTool: () => PaintTool,
  interaction: InteractionState,
  previewState: ToolPreviewState,
): void => {
  const startDrawing = (event: MouseEvent): void => {
    interaction.isDrawing = true;
    // Hide hover preview as soon as ink starts flowing.
    previewState.active = null;
    const firstPoint = toCanvasPoint(canvas, event);

    // Starting a new stroke invalidates redo history, so reset it here.
    model.redoStack.length = 0;

    const tool = getActiveTool();
    if (tool.type === "marker") {
      model.commands.push(createMarkerLine(firstPoint, tool.thickness));
    } else {
      model.commands.push(createStickerCommand(tool.emoji, firstPoint));
    }
    canvas.dispatchEvent(new Event(DRAWING_CHANGED_EVENT));
  };

  const continueStroke = (event: MouseEvent): void => {
    if (!interaction.isDrawing) return;
    const point = toCanvasPoint(canvas, event);
    const currentStroke = model.commands[model.commands.length - 1];
    currentStroke.drag(point.x, point.y);
    canvas.dispatchEvent(new Event(DRAWING_CHANGED_EVENT));
  };

  const stopDrawing = (): void => {
    interaction.isDrawing = false;
  };

  canvas.addEventListener("mousedown", startDrawing);
  canvas.addEventListener("mousemove", continueStroke);
  canvas.addEventListener("mouseup", stopDrawing);
  canvas.addEventListener("mouseleave", stopDrawing);
};

// Updates the hover preview on cursor movement without committing a stroke.
const attachToolPreview = (
  canvas: HTMLCanvasElement,
  getActiveTool: () => PaintTool,
  interaction: InteractionState,
  previewState: ToolPreviewState,
): void => {
  const updatePreview = (event: MouseEvent): void => {
    if (interaction.isDrawing) {
      previewState.active = null;
      canvas.dispatchEvent(new Event(TOOL_MOVED_EVENT));
      return;
    }

    const point = toCanvasPoint(canvas, event);
    const tool = getActiveTool();
    previewState.active = tool.type === "marker"
      ? createMarkerPreview(point, tool.thickness)
      : createStickerPreview(tool.emoji, point);
    canvas.dispatchEvent(new Event(TOOL_MOVED_EVENT));
  };

  const clearPreview = (): void => {
    previewState.active = null;
    canvas.dispatchEvent(new Event(TOOL_MOVED_EVENT));
  };

  canvas.addEventListener("mousemove", updatePreview);
  canvas.addEventListener("mouseleave", clearPreview);
};

// Redraw the full set of draw commands whenever the model reports a change.
const attachDrawingObserver = (
  canvas: HTMLCanvasElement,
  context: CanvasRenderingContext2D,
  model: DrawingModel,
  previewState: ToolPreviewState,
): void => {
  const render = (): void => {
    context.clearRect(0, 0, canvas.width, canvas.height);

    model.commands.forEach((command) => {
      command.display(context);
    });

    // Only show the preview when available; drawing commands always take precedence.
    if (previewState.active) {
      previewState.active.draw(context);
    }
  };

  canvas.addEventListener(DRAWING_CHANGED_EVENT, render);
  canvas.addEventListener(TOOL_MOVED_EVENT, render);
};

// Wire up the clear button to reset the drawing model and refresh the view.
const attachClearHandler = (
  button: HTMLButtonElement,
  canvas: HTMLCanvasElement,
  model: DrawingModel,
): void => {
  button.addEventListener("click", () => {
    model.commands.length = 0;
    model.redoStack.length = 0;
    canvas.dispatchEvent(new Event(DRAWING_CHANGED_EVENT));
  });
};

// Wire up undo and redo buttons to maintain drawing history stacks.
const attachUndoRedoHandlers = (
  undoButton: HTMLButtonElement,
  redoButton: HTMLButtonElement,
  canvas: HTMLCanvasElement,
  model: DrawingModel,
): void => {
  // Move the most recent command to the redo stack and refresh the canvas.
  undoButton.addEventListener("click", () => {
    const undoneCommand = model.commands.pop();
    if (!undoneCommand) return;
    model.redoStack.push(undoneCommand);
    canvas.dispatchEvent(new Event(DRAWING_CHANGED_EVENT));
  });

  // Restore the most recently undone command to the main history and redraw.
  redoButton.addEventListener("click", () => {
    const restoredCommand = model.redoStack.pop();
    if (!restoredCommand) return;
    model.commands.push(restoredCommand);
    canvas.dispatchEvent(new Event(DRAWING_CHANGED_EVENT));
  });
};

// starts the UI creation and register paint behavior when the module loads.
const main = (): void => {
  const {
    canvas,
    clearButton,
    undoButton,
    redoButton,
    thinButton,
    thickButton,
    stickerButtons,
  } = initializeLayout();
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Canvas 2D context unavailable.");
  }

  const model: DrawingModel = { commands: [], redoStack: [] };
  const interaction: InteractionState = { isDrawing: false };
  const previewState = createToolPreviewState();
  const getActiveTool = attachToolSelector(
    canvas,
    thinButton,
    thickButton,
    stickerButtons,
    previewState,
  );

  enableDrawing(canvas, model, getActiveTool, interaction, previewState);
  attachToolPreview(canvas, getActiveTool, interaction, previewState);
  attachDrawingObserver(canvas, context, model, previewState);
  attachClearHandler(clearButton, canvas, model);
  attachUndoRedoHandlers(undoButton, redoButton, canvas, model);
};

// starts the UI creation when the module loads.
main();
