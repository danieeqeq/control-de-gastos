const KEY = "controlGastos_v1";

let movements = JSON.parse(localStorage.getItem(KEY) || "[]");
let selectedMonth = new Date().toISOString().slice(0, 7);

let categoryChart = null;
let monthlyChart = null;


// ===============================
// FUNCIONES BÁSICAS
// ===============================

const $ = id => document.getElementById(id);

const money = n =>
  `S/ ${Number(n).toLocaleString("es-PE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;

const today = () =>
  new Date().toISOString().slice(0, 10);

const monthName = m =>
  new Date(m + "-02").toLocaleDateString("es-PE", {
    month: "long",
    year: "numeric"
  });

const save = () =>
  localStorage.setItem(KEY, JSON.stringify(movements));


// ===============================
// GENERAR ID SEGURO PARA HTTP
// ===============================
// IMPORTANTE:
// crypto.randomUUID() puede fallar cuando
// abrimos la app desde 192.168.x.x por HTTP.

function generateId() {

  if (
    window.crypto &&
    typeof window.crypto.randomUUID === "function"
  ) {
    try {
      return window.crypto.randomUUID();
    } catch (e) {
      // Usamos el método alternativo
    }
  }

  return (
    Date.now().toString(36) +
    Math.random().toString(36).substring(2, 10)
  );
}


// ===============================
// ICONOS
// ===============================

const icon = {
  Comida: "🍔",
  Transporte: "🚗",
  Casa: "🏠",
  Entretenimiento: "🎮",
  Compras: "🛍️",
  Salud: "💊",
  Trabajo: "💼",
  Educación: "📚",
  Otros: "📦"
};


// ===============================
// DATOS DEL MES
// ===============================

function monthData(month) {

  const list = movements.filter(x =>
    x.date.startsWith(month)
  );

  const income = list
    .filter(x => x.type === "income")
    .reduce((s, x) => s + Number(x.amount), 0);

  const expense = list
    .filter(x => x.type === "expense")
    .reduce((s, x) => s + Number(x.amount), 0);

  return {
    list,
    income,
    expense,
    balance: income - expense
  };
}


// ===============================
// RENDER PRINCIPAL
// ===============================

function render() {

  $("monthPicker").value = selectedMonth;
  $("summaryMonth").value = selectedMonth;

  $("welcomeMonth").textContent =
    "Resumen de " + monthName(selectedMonth);

  const d = monthData(selectedMonth);

  $("balance").textContent = money(d.balance);
  $("income").textContent = money(d.income);
  $("expense").textContent = money(d.expense);
  $("count").textContent = d.list.length;

  renderRecent(d.list);
  renderAll();
  renderCategoryChart(d.list);
  renderSummary(d);
}


// ===============================
// MOVIMIENTOS RECIENTES
// ===============================

function renderRecent(list) {

  const arr = [...list]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 6);

  $("recentList").innerHTML =
    arr.length
      ? arr.map(row).join("")
      : `
        <div class="empty">
          Todavía no hay movimientos este mes.
          <br>
          ¡Agrega el primero! 👇
        </div>
      `;
}


// ===============================
// FILA DE MOVIMIENTO
// ===============================

function row(x) {

  return `
    <div class="movement">

      <div class="icon">
        ${icon[x.category] || "📦"}
      </div>

      <div class="movement-main">

        <strong>
          ${esc(x.description)}
        </strong>

        <small>
          ${x.category}
          ·
          ${new Date(x.date + "T12:00").toLocaleDateString("es-PE")}
          ${x.note ? " · " + esc(x.note) : ""}
        </small>

      </div>

      <div class="amount ${x.type}">
        ${x.type === "income" ? "+" : "−"}
        ${money(x.amount)}
      </div>

      <div class="actions">

        <button
          class="icon-btn edit"
          onclick="editMovement('${x.id}')">
          ✏️
        </button>

        <button
          class="icon-btn"
          onclick="deleteMovement('${x.id}')">
          🗑️
        </button>

      </div>

    </div>
  `;
}


// ===============================
// TODOS LOS MOVIMIENTOS
// ===============================

function renderAll() {

  const q = $("search").value
    .toLowerCase()
    .trim();

  const tf = $("typeFilter").value;
  const cf = $("categoryFilter").value;

  let list = movements.filter(x =>
    x.date.startsWith(selectedMonth)
  );

  if (q) {

    list = list.filter(x =>
      (
        x.description +
        " " +
        x.category +
        " " +
        (x.note || "")
      )
        .toLowerCase()
        .includes(q)
    );

  }

  if (tf !== "all") {

    list = list.filter(x =>
      x.type === tf
    );

  }

  if (cf !== "all") {

    list = list.filter(x =>
      x.category === cf
    );

  }

  list.sort((a, b) =>
    b.date.localeCompare(a.date)
  );

  $("allMovements").innerHTML =
    list.length
      ? list.map(row).join("")
      : `
        <div class="empty">
          No encontramos movimientos con esos filtros.
        </div>
      `;
}


// ===============================
// FILTRO DE CATEGORÍAS
// ===============================

function updateCategoryFilter() {

  const cats = [
    ...new Set(
      movements.map(x => x.category)
    )
  ].sort();

  const current =
    $("categoryFilter").value;

  $("categoryFilter").innerHTML =
    `
      <option value="all">
        Todas las categorías
      </option>
    ` +
    cats
      .map(c =>
        `<option value="${c}">${icon[c] || "📦"} ${c}</option>`
      )
      .join("");

  $("categoryFilter").value =
    cats.includes(current)
      ? current
      : "all";
}


// ===============================
// 🎨 GRÁFICO CIRCULAR
// ===============================

function renderCategoryChart(list) {

  const sums = {};

  list
    .filter(x => x.type === "expense")
    .forEach(x => {

      sums[x.category] =
        (sums[x.category] || 0) +
        Number(x.amount);

    });

  const labels = Object.keys(sums);
  const values = Object.values(sums);

  $("noChart").style.display =
    labels.length ? "none" : "grid";

  if (categoryChart) {

    categoryChart.destroy();
    categoryChart = null;

  }

  if (!labels.length) return;


  // 🎨 COLORES DEL GRÁFICO

  const colors = [
    "#6366f1",
    "#22c55e",
    "#ef4444",
    "#f59e0b",
    "#06b6d4",
    "#ec4899",
    "#8b5cf6",
    "#14b8a6",
    "#f97316"
  ];


  const textColor =
    getComputedStyle(document.body)
      .getPropertyValue("--text")
      .trim();


  const borderColor =
    document.body.classList.contains("dark")
      ? "#171a21"
      : "#ffffff";


  categoryChart = new Chart(
    $("categoryChart"),
    {

      type: "doughnut",

      data: {

        labels: labels,

        datasets: [

          {

            data: values,

            backgroundColor:
              labels.map(
                (_, i) =>
                  colors[i % colors.length]
              ),

            borderColor: borderColor,

            borderWidth: 3,

            hoverOffset: 8

          }

        ]

      },

      options: {

        responsive: true,

        maintainAspectRatio: false,

        cutout: "62%",

        plugins: {

          legend: {

            position: "bottom",

            labels: {

              color: textColor,

              padding: 14,

              usePointStyle: true,

              pointStyle: "circle",

              font: {
                size: 12
              }

            }

          },

          tooltip: {

            callbacks: {

              label: function(context) {

                return (
                  " " +
                  context.label +
                  ": " +
                  money(context.raw)
                );

              }

            }

          }

        },

        animation: {

          duration: 600

        }

      }

    }
  );
}


// ===============================
// 📊 RESUMEN MENSUAL
// ===============================

function renderSummary(d) {

  $("summaryIncome").textContent =
    money(d.income);

  $("summaryExpense").textContent =
    money(d.expense);

  $("summaryBalance").textContent =
    money(d.balance);


  // GASTOS POR CATEGORÍA

  const sums = {};

  d.list
    .filter(x => x.type === "expense")
    .forEach(x => {

      sums[x.category] =
        (sums[x.category] || 0) +
        Number(x.amount);

    });


  const max =
    Math.max(
      ...Object.values(sums),
      1
    );


  $("categorySummary").innerHTML =
    Object.keys(sums).length

      ?

      Object.entries(sums)
        .sort((a, b) => b[1] - a[1])

        .map(([c, v]) => `

          <div class="category-row">

            <div class="cat-head">

              <span>
                ${icon[c] || "📦"} ${c}
              </span>

              <strong>
                ${money(v)}
              </strong>

            </div>

            <div class="bar">

              <i
                style="width:${v / max * 100}%">
              </i>

            </div>

          </div>

        `)
        .join("")

      :

      `
        <div class="empty">
          No hay gastos en este mes.
        </div>
      `;


  // ÚLTIMOS 6 MESES

  const months = [];

  for (let i = 5; i >= 0; i--) {

    const dt =
      new Date(
        selectedMonth + "-01T12:00"
      );

    dt.setMonth(
      dt.getMonth() - i
    );

    months.push(
      dt.toISOString().slice(0, 7)
    );

  }


  const incomes =
    months.map(m =>
      monthData(m).income
    );

  const expenses =
    months.map(m =>
      monthData(m).expense
    );


  if (monthlyChart) {

    monthlyChart.destroy();
    monthlyChart = null;

  }


  const textColor =
    getComputedStyle(document.body)
      .getPropertyValue("--text")
      .trim();

  const mutedColor =
    getComputedStyle(document.body)
      .getPropertyValue("--muted")
      .trim();

  const borderColor =
    getComputedStyle(document.body)
      .getPropertyValue("--border")
      .trim();


  // GRÁFICO DE BARRAS

  monthlyChart = new Chart(
    $("monthlyChart"),
    {

      type: "bar",

      data: {

        labels:
          months.map(m =>
            new Date(m + "-02")
              .toLocaleDateString(
                "es-PE",
                {
                  month: "short"
                }
              )
          ),

        datasets: [

          {

            label: "Ingresos",

            data: incomes,

            backgroundColor:
              "#22c55e",

            borderRadius: 7,

            borderSkipped: false

          },

          {

            label: "Gastos",

            data: expenses,

            backgroundColor:
              "#ef4444",

            borderRadius: 7,

            borderSkipped: false

          }

        ]

      },

      options: {

        responsive: true,

        maintainAspectRatio: false,

        plugins: {

          legend: {

            labels: {

              color: textColor,

              usePointStyle: true,

              padding: 15

            }

          }

        },

        scales: {

          x: {

            ticks: {
              color: mutedColor
            },

            grid: {
              color: borderColor
            }

          },

          y: {

            beginAtZero: true,

            ticks: {

              color: mutedColor,

              callback: function(value) {

                return "S/ " + value;

              }

            },

            grid: {
              color: borderColor
            }

          }

        }

      }

    }
  );
}


// ===============================
// MODAL
// ===============================

function openModal(x = null) {

  $("modal").classList.remove("hidden");

  $("modalTitle").textContent =
    x
      ? "Editar movimiento"
      : "Nuevo movimiento";

  $("editId").value =
    x?.id || "";

  $("description").value =
    x?.description || "";

  $("amount").value =
    x?.amount || "";

  $("date").value =
    x?.date || today();

  $("category").value =
    x?.category || "Comida";

  $("note").value =
    x?.note || "";


  const type =
    x?.type || "expense";

  const radio =
    document.querySelector(
      `input[name="type"][value="${type}"]`
    );

  if (radio) {
    radio.checked = true;
  }
}


// ===============================
// CERRAR MODAL
// ===============================

function closeModal() {

  $("modal").classList.add(
    "hidden"
  );

}


// ===============================
// GUARDAR MOVIMIENTO
// ===============================

$("movementForm").addEventListener(
  "submit",
  e => {

    e.preventDefault();


    // =================================
    // AQUÍ ESTÁ LA CORRECCIÓN IMPORTANTE
    // =================================

    const id =
      $("editId").value ||
      generateId();


    const checkedType =
      document.querySelector(
        'input[name="type"]:checked'
      );


    if (!checkedType) {

      alert("Selecciona si es gasto o ingreso.");
      return;

    }


    const description =
      $("description").value.trim();

    const amount =
      Number($("amount").value);

    const date =
      $("date").value;

    const category =
      $("category").value;

    const note =
      $("note").value.trim();


    // VALIDACIÓN

    if (!description) {

      alert("Escribe una descripción.");
      return;

    }


    if (!amount || amount <= 0) {

      alert("Ingresa un monto válido.");
      return;

    }


    if (!date) {

      alert("Selecciona una fecha.");
      return;

    }


    const item = {

      id,

      type: checkedType.value,

      description,

      amount,

      date,

      category,

      note

    };


    const idx =
      movements.findIndex(
        x => x.id === id
      );


    if (idx >= 0) {

      movements[idx] = item;

    } else {

      movements.push(item);

    }


    // GUARDAR

    save();


    // CAMBIAR AL MES DEL MOVIMIENTO

    selectedMonth =
      item.date.slice(0, 7);


    updateCategoryFilter();

    closeModal();

    render();

  }
);


// ===============================
// EDITAR
// ===============================

function editMovement(id) {

  const x =
    movements.find(
      x => x.id === id
    );

  if (x) {

    openModal(x);

  }

}


// ===============================
// ELIMINAR
// ===============================

function deleteMovement(id) {

  const x =
    movements.find(
      x => x.id === id
    );

  if (!x) return;


  if (
    confirm(
      `¿Eliminar "${x.description}"?`
    )
  ) {

    movements =
      movements.filter(
        x => x.id !== id
      );

    save();

    updateCategoryFilter();

    render();

  }

}


// ===============================
// SEGURIDAD HTML
// ===============================

function esc(s) {

  return String(s).replace(
    /[&<>"']/g,
    m =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
      })[m]
  );

}


// ===============================
// NAVEGACIÓN
// ===============================

document
  .querySelectorAll(".nav-btn")
  .forEach(b => {

    b.onclick = () =>
      go(b.dataset.section);

  });


document
  .querySelectorAll("[data-go]")
  .forEach(b => {

    b.onclick = () =>
      go(b.dataset.go);

  });


function go(sec) {

  document
    .querySelectorAll(".section")
    .forEach(s =>
      s.classList.remove("active")
    );


  $(sec).classList.add("active");


  document
    .querySelectorAll(".nav-btn")
    .forEach(b =>
      b.classList.toggle(
        "active",
        b.dataset.section === sec
      )
    );


  $("pageTitle").textContent =
    sec === "inicio"
      ? "Mi dinero"
      : sec === "movimientos"
        ? "Movimientos"
        : "Resumen mensual";

}


// ===============================
// BOTONES
// ===============================

$("addBtn").onclick =
  () => openModal();

$("addTopBtn").onclick =
  () => openModal();


$("closeModal").onclick =
  closeModal;


$("modal").onclick = e => {

  if (
    e.target === $("modal")
  ) {

    closeModal();

  }

};


// ===============================
// CAMBIO DE MES
// ===============================

$("monthPicker").onchange =
  e => {

    selectedMonth =
      e.target.value;

    render();

  };


$("summaryMonth").onchange =
  e => {

    selectedMonth =
      e.target.value;

    render();

  };


// ===============================
// FILTROS
// ===============================

[
  "search",
  "typeFilter",
  "categoryFilter"
].forEach(id => {

  $(id).addEventListener(
    "input",
    renderAll
  );

});


// ===============================
// 🌙 MODO OSCURO / CLARO
// ===============================

$("themeBtn").onclick = () => {

  document.body.classList.toggle(
    "dark"
  );


  const dark =
    document.body.classList.contains(
      "dark"
    );


  localStorage.setItem(
    "theme",
    dark
      ? "dark"
      : "light"
  );


  $("themeBtn").textContent =
    dark
      ? "☀️ Modo claro"
      : "🌙 Modo oscuro";


  // Actualizar gráficos
  render();

};


// ===============================
// 🌑 OSCURO POR DEFECTO
// ===============================

const savedTheme =
  localStorage.getItem("theme");


if (
  savedTheme === "dark" ||
  savedTheme === null
) {

  document.body.classList.add(
    "dark"
  );

  $("themeBtn").textContent =
    "☀️ Modo claro";

} else {

  document.body.classList.remove(
    "dark"
  );

  $("themeBtn").textContent =
    "🌙 Modo oscuro";

}


// ===============================
// 🗑️ BORRAR TODO
// ===============================

$("clearBtn").onclick = () => {

  if (
    movements.length &&
    confirm(
      "¿Seguro que quieres borrar TODOS los movimientos? Esta acción no se puede deshacer."
    )
  ) {

    movements = [];

    save();

    updateCategoryFilter();

    render();

  }

};


// ===============================
// INICIAR APP
// ===============================

updateCategoryFilter();

render();