import "./style.css";

// Describe the core elements needed to build the paint app's layout.
interface PaintAppElements {
  root: HTMLElement;
  title: HTMLHeadingElement;
  canvas: HTMLCanvasElement;
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

// Assemble the page layout and return references to the created elements.
const initializeLayout = (): PaintAppElements => {
  const root = document.body;
  root.innerHTML = "";

  const title = createTitle(APP_TITLE);
  const canvas = createCanvas(CANVAS_SIZE);

  root.append(title, canvas);

  return { root, title, canvas };
};

// Kick off the UI creation when the module loads.
initializeLayout();
