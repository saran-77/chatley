(function () {
  try {
    var stored = localStorage.getItem("chatley-theme")
    var theme = stored ? JSON.parse(stored).state.theme : "light"
    if (theme === "dark") document.documentElement.classList.add("dark")
    document.documentElement.style.colorScheme = theme === "dark" ? "dark" : "light"
  } catch (e) {}
})()
