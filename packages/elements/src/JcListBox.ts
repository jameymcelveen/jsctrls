import { createListBoxController, type DataSet, type ListBoxController } from "@jsctrls/core";

export const LISTBOX_TAG = "jc-listbox";

type Row = { id: string } & Record<string, unknown>;

/**
 * `<jc-listbox display="name">`: a plain custom element over the core ListBox
 * controller. Set the `dataSet` property in script. No shadow DOM, so page
 * styles for `.jsctrls-*` classes apply as they do to the React skin.
 */
export class JcListBox extends HTMLElement {
  static readonly observedAttributes = ["display"];

  #dataSet: DataSet<Row> | null = null;
  #controller: ListBoxController | null = null;
  #unsubscribe: (() => void) | null = null;

  get dataSet(): DataSet<Row> | null {
    return this.#dataSet;
  }

  set dataSet(value: DataSet<Row> | null) {
    this.#dataSet = value;
    this.#bind();
  }

  connectedCallback(): void {
    this.#bind();
  }

  disconnectedCallback(): void {
    this.#unsubscribe?.();
    this.#unsubscribe = null;
  }

  attributeChangedCallback(): void {
    this.#bind();
  }

  #bind(): void {
    this.#unsubscribe?.();
    this.#unsubscribe = null;
    this.#controller = null;
    const display = this.getAttribute("display");
    if (!this.#dataSet || !display || !this.isConnected) {
      this.replaceChildren();
      return;
    }
    const controller = createListBoxController({ dataSet: this.#dataSet, display });
    this.#controller = controller;
    this.#unsubscribe = controller.subscribe(() => {
      this.#render();
    });
    this.#render();
  }

  #render(): void {
    const controller = this.#controller;
    if (!controller) {
      return;
    }
    const { options, list, status, error } = controller.getSnapshot();

    const box = document.createElement("div");
    box.className = "jsctrls-listbox";
    for (const [name, value] of Object.entries(list)) {
      box.setAttribute(name, value);
    }
    box.addEventListener("keydown", (event) => {
      if (controller.keyDown(event.key)) {
        event.preventDefault();
      }
    });
    for (const option of options) {
      const item = document.createElement("div");
      item.className = option.selected ? "jsctrls-option is-selected" : "jsctrls-option";
      for (const [name, value] of Object.entries(option.attributes)) {
        item.setAttribute(name, value);
      }
      item.textContent = option.label;
      item.addEventListener("click", () => {
        controller.select(option.id);
      });
      box.append(item);
    }

    const parts: HTMLElement[] = [box];
    if (status) {
      parts.push(paragraph("jsctrls-status", status));
    }
    if (error) {
      const alert = paragraph("jsctrls-error", error);
      alert.setAttribute("role", "alert");
      parts.push(alert);
    }
    const hadFocus = this.contains(document.activeElement);
    this.replaceChildren(...parts);
    if (hadFocus) {
      box.focus();
    }
  }
}

function paragraph(className: string, text: string): HTMLParagraphElement {
  const element = document.createElement("p");
  element.className = className;
  element.textContent = text;
  return element;
}

/** Register `<jc-listbox>` once. Safe to call more than once. */
export function defineJcListBox(registry: CustomElementRegistry = customElements): void {
  if (!registry.get(LISTBOX_TAG)) {
    registry.define(LISTBOX_TAG, JcListBox);
  }
}
