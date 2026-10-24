/** Replaces the page content with a readable error instead of leaving a black screen. */
export function showFatalError(title: string, detail: unknown): void {
  const message = detail instanceof Error ? detail.message : String(detail);
  console.error(title, detail);
  let panel = document.querySelector<HTMLElement>('.fatal-error');
  if (!panel) {
    panel = document.createElement('div');
    panel.className = 'fatal-error';
    panel.setAttribute('role', 'alert');
    document.body.appendChild(panel);
  }
  panel.replaceChildren();
  const heading = document.createElement('h2');
  heading.textContent = title;
  const body = document.createElement('p');
  body.textContent = message;
  panel.append(heading, body);
}
