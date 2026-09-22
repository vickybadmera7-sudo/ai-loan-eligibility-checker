/**
 * main.js
 * Shared behaviour across all pages: active nav highlighting,
 * current year in footer, mobile-safe smooth scroll.
 */

document.addEventListener("DOMContentLoaded", () => {
  const currentPath = window.location.pathname.split("/").pop() || "index.html";

  document.querySelectorAll("nav.tools a").forEach((link) => {
    const linkPath = link.getAttribute("href");
    if (linkPath === currentPath) {
      link.classList.add("active");
    }
  });

  const yearEl = document.querySelector("[data-year]");
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }
});
