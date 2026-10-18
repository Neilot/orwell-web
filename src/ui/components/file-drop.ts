import { el } from '../dom';

/**
 * Lets a file be dropped anywhere on the page. While one is dragged, `onOver(true)` lets the
 * page highlight its drop zone; when there is none to highlight, an overlay covers the page.
 */
export class FileDrop {
  readonly element = el('div');
  private depth = 0;

  constructor(
    message: string,
    icon: SVGSVGElement,
    onFile: (file: File) => void,
    private readonly onOver: (over: boolean) => boolean,
  ) {
    this.element.id = 'dropOverlay';
    this.element.hidden = true;
    const box = el('div');
    box.append(icon, message);
    this.element.append(box);

    const hasFiles = (ev: DragEvent): boolean =>
      [...(ev.dataTransfer?.types ?? [])].includes('Files');
    document.addEventListener('dragenter', (ev) => {
      if (!hasFiles(ev)) return;
      ev.preventDefault();
      this.depth++;
      // The page's own drop zone takes it when there is one; otherwise, the overlay.
      if (!this.onOver(true)) this.element.hidden = false;
    });
    document.addEventListener('dragover', (ev) => {
      if (!hasFiles(ev)) return;
      ev.preventDefault();
      if (ev.dataTransfer) ev.dataTransfer.dropEffect = 'copy';
    });
    document.addEventListener('dragleave', (ev) => {
      if (!hasFiles(ev)) return;
      this.depth = Math.max(0, this.depth - 1);
      if (this.depth === 0) this.end();
    });
    document.addEventListener('drop', (ev) => {
      if (!hasFiles(ev)) return;
      ev.preventDefault();
      this.end();
      const file = ev.dataTransfer?.files[0];
      if (file) onFile(file);
    });
  }

  private end(): void {
    this.depth = 0;
    this.element.hidden = true;
    this.onOver(false);
  }
}
