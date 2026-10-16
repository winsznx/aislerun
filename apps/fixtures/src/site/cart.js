(function () {
  var KEY = "fixture-cart:{{VERSION}}";

  function readCart() {
    try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch (e) { return []; }
  }

  function writeCart(items) { localStorage.setItem(KEY, JSON.stringify(items)); }

  function render() {
    var items = readCart();
    var count = items.reduce(function (n, i) { return n + i.quantity; }, 0);
    document.querySelectorAll("[data-cart-count]").forEach(function (el) { el.textContent = String(count); });
    document.querySelectorAll("[data-cart-items]").forEach(function (list) {
      list.innerHTML = "";
      items.forEach(function (i) {
        var li = document.createElement("li");
        li.className = "cart-item";
        li.setAttribute("data-cart-item", i.id);
        li.textContent = i.title + " – " + i.variant + " × " + i.quantity;
        list.appendChild(li);
      });
    });
  }

  function cartDrawer() {
{{DRAWER_LOOKUP}}
  }

  var form = document.querySelector("[data-product-form]");
  if (form) {
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var variant = form.querySelector("input[name=variant]:checked").value;
      var drawer = cartDrawer();
      drawer.hidden = false;
      var items = readCart();
      var existing = items.find(function (i) { return i.id === "cup-001:" + variant; });
      if (existing) existing.quantity += 1;
      else items.push({ id: "cup-001:" + variant, title: "Stoneware Cup", variant: variant, quantity: 1 });
      writeCart(items);
      render();
    });
  }

  render();
})();
