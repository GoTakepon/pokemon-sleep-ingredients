export function showToast(message, type = "info") {
    let container = document.getElementById("toast-container");
    if (!container) {
        container = document.createElement("div");
        container.id = "toast-container";
        document.body.appendChild(container);
    }

    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    // Animation handling
    toast.style.opacity = "0";
    toast.style.transform = "translateY(20px)";

    container.appendChild(toast);

    // Trigger reflow
    void toast.offsetWidth;

    toast.style.opacity = "1";
    toast.style.transform = "translateY(0)";

    const duration = type === "error" ? 5000 : 3000;

    setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transform = "translateY(-20px)";
        toast.addEventListener("transitionend", () => {
            toast.remove();
            if (container.children.length === 0) {
                container.remove();
            }
        });
    }, duration);
}
