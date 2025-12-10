import "./style.css";

// Describe the core elements needed to build the paint app's layout.
interface PaintAppElements {
  root: HTMLElement;
  title: HTMLHeadingElement;
  canvas: HTMLCanvasElement;
  clearButton: HTMLButtonElement;
}

// Basic configuration values for the UI.
const APP_TITLE = "Browser Paint Tool";
const CANVAS_SIZE = 256;

// Build the heading element that labels the program in browser.
const createTitle = (text: string): HTMLHeadingElement => {
  const heading = document.createElement("h1");
  heading.id = "app-title";
  heading.textContent = text;
  return heading;
};

// Build the canvas element that will host the drawing surface.
const createCanvas = (size: number): HTMLCanvasElement => {
  const canvas = document.createElement("canvas");
  canvas.id = "paint-canvas";
  canvas.width = size;
  canvas.height = size;
  canvas.setAttribute("aria-label", "Drawing canvas");
  return canvas;
};

// Build a container that holds paint controls, starting with a clear button.
const createControls = (): {
  controls: HTMLDivElement;
  clearButton: HTMLButtonElement;
} => {
  const controls = document.createElement("div");
  controls.id = "controls";

  const clearButton = document.createElement("button");
  clearButton.id = "clear-button";
  clearButton.type = "button";
  clearButton.textContent = "Clear Canvas";

  controls.append(clearButton);

  return { controls, clearButton };
};

// Assemble the page layout and return references to the created elements.
const initializeLayout = (): PaintAppElements => {
  const root = document.body;
  root.innerHTML = "";

  const title = createTitle(APP_TITLE);
  const canvas = createCanvas(CANVAS_SIZE);
  const { controls, clearButton } = createControls();

  root.append(title, controls, canvas);

  return { root, title, canvas, clearButton };
};

// Track current drawing state for mouse interactions.
interface DrawingState {
  isDrawing: boolean;
  lastX: number;
  lastY: number;
}

// Attach mouse listeners to draw directly onto the canvas.
const enableDrawing = (
  canvas: HTMLCanvasElement,
  context: CanvasRenderingContext2D,
): void => {
  const state: DrawingState = { isDrawing: false, lastX: 0, lastY: 0 };

  // Configure basic stroke style for the marker tool.
  context.lineWidth = 4;
  context.lineCap = "round";
  context.strokeStyle = "#111827";

  const toCanvasPoint = (event: MouseEvent): { x: number; y: number } => {
    const bounds = canvas.getBoundingClientRect();
    return {
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
    };
  };

  const startDrawing = (event: MouseEvent): void => {
    state.isDrawing = true;
    const point = toCanvasPoint(event);
    state.lastX = point.x;
    state.lastY = point.y;
    context.beginPath();
    context.moveTo(point.x, point.y);
  };

  const continueStroke = (event: MouseEvent): void => {
    if (!state.isDrawing) return;
    const point = toCanvasPoint(event);
    context.lineTo(point.x, point.y);
    context.stroke();
    state.lastX = point.x;
    state.lastY = point.y;
  };

  const stopDrawing = (): void => {
    state.isDrawing = false;
    context.closePath();
  };

  canvas.addEventListener("mousedown", startDrawing);
  canvas.addEventListener("mousemove", continueStroke);
  canvas.addEventListener("mouseup", stopDrawing);
  canvas.addEventListener("mouseleave", stopDrawing);
};

// Wire up the clear button to reset the drawing surface.
const attachClearHandler = (
  button: HTMLButtonElement,
  canvas: HTMLCanvasElement,
  context: CanvasRenderingContext2D,
): void => {
  button.addEventListener("click", () => {
    context.clearRect(0, 0, canvas.width, canvas.height);
  });
};

// Kick off the UI creation and register paint behavior when the module loads.
const main = (): void => {
  const { canvas, clearButton } = initializeLayout();
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Canvas 2D context unavailable.");
  }

  enableDrawing(canvas, context);
  attachClearHandler(clearButton, canvas, context);
};

// Kick off the UI creation when the module loads.
main();
