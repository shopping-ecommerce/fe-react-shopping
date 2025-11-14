const W = typeof window !== "undefined" ? window : globalThis;

if (!W.__appToastBus) {
  W.__appToastBus = {
    show({ title, text = "", type = "info", id, duration = 2500 }) {
      const toastId =
        id ||
        `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      W.dispatchEvent(
        new CustomEvent("app-toast", {
          detail: { id: toastId, title, text, type, duration },
        })
      );
      return toastId;
    },

    hide(id) {
      if (!id) return;
      W.dispatchEvent(new CustomEvent("app-toast-dismiss", { detail: { id } }));
    },

    confirm({
      title = "Xác nhận",
      text = "",
      confirmText = "Đồng ý",
      cancelText = "Hủy",
      type = "warning",
    }) {
      return new Promise((resolve) => {
        const id = `confirm-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 6)}`;
        const onAnswer = (e) => {
          if (e?.detail?.id !== id) return;
          W.removeEventListener("app-confirm-answer", onAnswer);
          resolve(!!e?.detail?.ok);
        };
        W.addEventListener("app-confirm-answer", onAnswer);
        W.dispatchEvent(
          new CustomEvent("app-confirm", {
            detail: { id, title, text, confirmText, cancelText, type },
          })
        );
      });
    },
  };
}

export const showToast = (opts) => W.__appToastBus.show(opts);
export const hideToast = (id) => W.__appToastBus.hide(id);
export const confirmToast = (opts) => W.__appToastBus.confirm(opts);
