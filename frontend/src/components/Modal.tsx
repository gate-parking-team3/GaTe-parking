import type { KeyboardEvent, ReactNode } from "react";
import Icon from "./Icon";

type ModalProps = {
  title: string;
  onClose: () => void;
  // While busy (e.g. saving), the dialog cannot be closed.
  busy?: boolean;
  children: ReactNode;
};

/** Dialog over a dimmed page. Escape, the close button and a click outside close it. */
export default function Modal({
  title,
  onClose,
  busy = false,
  children,
}: ModalProps) {
  function close() {
    if (!busy) onClose();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") close();
  }

  return (
    // The backdrop only forwards Escape and outside clicks; the dialog itself is focusable content.
    <div className="backdrop" onClick={close} onKeyDown={handleKeyDown}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-h">
          <h2>{title}</h2>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={close}
            disabled={busy}
            aria-label="Close"
          >
            <Icon name="x" small />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
