import "./style.css";

// Core elements/buttons needed to build the paint app's layout.
interface PaintAppElements {
  root: HTMLElement;
  title: HTMLHeadingElement;
  canvas: HTMLCanvasElement;
  clearButton: HTMLButtonElement;
  undoButton: HTMLButtonElement;
  redoButton: HTMLButtonElement;
}

// Basic configuration values for the UI.
const APP_TITLE = "Browser Paint Tool";
const CANVAS_SIZE = 256;
const DRAWING_CHANGED_EVENT = "drawing-changed";

// Represent a point recorded from the user's cursor.
interface Point {
  x: number;
  y: number;
}

// A stroke is a list of points captured during a single drag gesture.
type Stroke = Point[];

// Collection of all recorded strokes.
interface DrawingModel {
  strokes: Stroke[];
  redoStack: Stroke[];
}

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
} => {
  const controls = document.createElement("div");
  controls.id = "controls";

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

  controls.append(clearButton, undoButton, redoButton);

  return { controls, clearButton, undoButton, redoButton };
};

// Assemble the page layout and return references to the created elements.
const initializeLayout = (): PaintAppElements => {
  const root = document.body;
  root.innerHTML = "";

  const title = createTitle(APP_TITLE);
  const canvas = createCanvas(CANVAS_SIZE);
  const { controls, clearButton, undoButton, redoButton } = createControls();

  root.append(title, controls, canvas);

  return { root, title, canvas, clearButton, undoButton, redoButton };
};

// Track whether the user is currently dragging the mouse to record a stroke.
interface InteractionState {
  isDrawing: boolean;
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

// Attach mouse listeners that record points into the drawing model.
const enableDrawing = (
  canvas: HTMLCanvasElement,
  model: DrawingModel,
): void => {
  const interaction: InteractionState = { isDrawing: false };

  const startDrawing = (event: MouseEvent): void => {
    interaction.isDrawing = true;
    const firstPoint = toCanvasPoint(canvas, event);

    // Starting a new stroke invalidates redo history, so reset it here.
    model.redoStack.length = 0;

    model.strokes.push([firstPoint]);
    canvas.dispatchEvent(new Event(DRAWING_CHANGED_EVENT));
  };

  const continueStroke = (event: MouseEvent): void => {
    if (!interaction.isDrawing) return;
    const point = toCanvasPoint(canvas, event);
    const currentStroke = model.strokes[model.strokes.length - 1];
    currentStroke.push(point);
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

// Redraw the full set of strokes whenever the model reports a change.
const attachDrawingObserver = (
  canvas: HTMLCanvasElement,
  context: CanvasRenderingContext2D,
  model: DrawingModel,
): void => {
  // Shared stroke styling for all segments.
  const applyStrokeStyle = (): void => {
    context.lineWidth = 4;
    context.lineCap = "round";
    context.strokeStyle = "#111827";
  };

  const render = (): void => {
    context.clearRect(0, 0, canvas.width, canvas.height);
    applyStrokeStyle();

    model.strokes.forEach((stroke) => {
      if (stroke.length === 0) return;
      context.beginPath();
      const [first, ...rest] = stroke;
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
    model.strokes.length = 0;
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
  // Move the most recent stroke to the redo stack and refresh the canvas.
  undoButton.addEventListener("click", () => {
    const undoneStroke = model.strokes.pop();
    if (!undoneStroke) return;
    model.redoStack.push(undoneStroke);
    canvas.dispatchEvent(new Event(DRAWING_CHANGED_EVENT));
  });

  // Restore the most recently undone stroke to the main history and redraw.
  redoButton.addEventListener("click", () => {
    const restoredStroke = model.redoStack.pop();
    if (!restoredStroke) return;
    model.strokes.push(restoredStroke);
    canvas.dispatchEvent(new Event(DRAWING_CHANGED_EVENT));
  });
};

// starts the UI creation and register paint behavior when the module loads.
const main = (): void => {
  const { canvas, clearButton, undoButton, redoButton } = initializeLayout();
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Canvas 2D context unavailable.");
  }

  const model: DrawingModel = { strokes: [], redoStack: [] };

  enableDrawing(canvas, model);
  attachDrawingObserver(canvas, context, model);
  attachClearHandler(clearButton, canvas, model);
  attachUndoRedoHandlers(undoButton, redoButton, canvas, model);
};

// starts the UI creation when the module loads.
main();
