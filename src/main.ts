import "./style.css";

// Core elements/buttons needed to build the paint app's layout.
interface PaintAppElements {
  root: HTMLElement;
  title: HTMLHeadingElement;
  canvas: HTMLCanvasElement;
  clearButton: HTMLButtonElement;
  undoButton: HTMLButtonElement;
  redoButton: HTMLButtonElement;
  thinButton: HTMLButtonElement;
  thickButton: HTMLButtonElement;
}

// Basic configuration values for the UI.
const APP_TITLE = "Browser Paint Tool";
const CANVAS_SIZE = 256;
const DRAWING_CHANGED_EVENT = "drawing-changed";
const THIN_MARKER_THICKNESS = 4;
const THICK_MARKER_THICKNESS = 10;

// Represent a point recorded from the user's cursor.
interface Point {
  x: number;
  y: number;
}

// Any drawable instruction that knows how to paint itself onto the canvas.
interface DrawCommand {
  display: (context: CanvasRenderingContext2D) => void;
}

// Specialized draw command that records freehand marker strokes.
// The drag method grows the line with additional positions as the user moves.
interface MarkerLine extends DrawCommand {
  drag: (x: number, y: number) => void;
}

// Collection of all recorded draw commands.
interface DrawingModel {
  commands: MarkerLine[];
  redoStack: MarkerLine[];
}

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
  controls: HTMLDivElement;
  clearButton: HTMLButtonElement;
  undoButton: HTMLButtonElement;
  redoButton: HTMLButtonElement;
  thinButton: HTMLButtonElement;
  thickButton: HTMLButtonElement;
} => {
  const controls = document.createElement("div");
  controls.id = "controls";

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

  controls.append(toolGroup, clearButton, undoButton, redoButton);

  return {
    controls,
    clearButton,
    undoButton,
    redoButton,
    thinButton,
    thickButton,
  };
};

// Assemble the page layout and return references to the created elements.
const initializeLayout = (): PaintAppElements => {
  const root = document.body;
  root.innerHTML = "";

  const title = createTitle(APP_TITLE);
  const canvas = createCanvas(CANVAS_SIZE);
  const {
    controls,
    clearButton,
    undoButton,
    redoButton,
    thinButton,
    thickButton,
  } = createControls();

  root.append(title, controls, canvas);

  return {
    root,
    title,
    canvas,
    clearButton,
    undoButton,
    redoButton,
    thinButton,
    thickButton,
  };
};

// Track whether the user is currently dragging the mouse to record a stroke.
interface InteractionState {
  isDrawing: boolean;
}

// Shared tool selection state that tracks which marker thickness is active.
interface ToolSelection {
  activeThickness: number;
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

// Set up the marker tool buttons and return a callback that reports the current
// thickness. Each button click updates the stored value and the visual
// selection state.
const attachToolSelector = (
  thinButton: HTMLButtonElement,
  thickButton: HTMLButtonElement,
): () => number => {
  const selection: ToolSelection = {
    activeThickness: THIN_MARKER_THICKNESS,
  };

  const applySelectionStyles = (activeButton: HTMLButtonElement): void => {
    const buttons = [thinButton, thickButton];
    buttons.forEach((button) => {
      const isActive = button === activeButton;
      button.classList.toggle("selected-tool", isActive);
    });
  };

  const chooseTool = (button: HTMLButtonElement, thickness: number): void => {
    selection.activeThickness = thickness;
    applySelectionStyles(button);
  };

  chooseTool(thinButton, THIN_MARKER_THICKNESS);

  thinButton.addEventListener("click", () => {
    chooseTool(thinButton, THIN_MARKER_THICKNESS);
  });

  thickButton.addEventListener("click", () => {
    chooseTool(thickButton, THICK_MARKER_THICKNESS);
  });

  return () => selection.activeThickness;
};

// Attach mouse listeners that record points into the drawing model.
const enableDrawing = (
  canvas: HTMLCanvasElement,
  model: DrawingModel,
  getActiveThickness: () => number,
): void => {
  const interaction: InteractionState = { isDrawing: false };

  const startDrawing = (event: MouseEvent): void => {
    interaction.isDrawing = true;
    const firstPoint = toCanvasPoint(canvas, event);

    // Starting a new stroke invalidates redo history, so reset it here.
    model.redoStack.length = 0;

    model.commands.push(createMarkerLine(firstPoint, getActiveThickness()));
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

// Redraw the full set of draw commands whenever the model reports a change.
const attachDrawingObserver = (
  canvas: HTMLCanvasElement,
  context: CanvasRenderingContext2D,
  model: DrawingModel,
): void => {
  const render = (): void => {
    context.clearRect(0, 0, canvas.width, canvas.height);

    model.commands.forEach((command) => {
      command.display(context);
    });
  };

  canvas.addEventListener(DRAWING_CHANGED_EVENT, render);
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
  } = initializeLayout();
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Canvas 2D context unavailable.");
  }

  const model: DrawingModel = { commands: [], redoStack: [] };
  const getActiveThickness = attachToolSelector(thinButton, thickButton);

  enableDrawing(canvas, model, getActiveThickness);
  attachDrawingObserver(canvas, context, model);
  attachClearHandler(clearButton, canvas, model);
  attachUndoRedoHandlers(undoButton, redoButton, canvas, model);
};

// starts the UI creation when the module loads.
main();
