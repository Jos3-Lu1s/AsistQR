// Vista provisional para las secciones que todavía no existen.

/** Pinta el aviso "Disponible pronto" con un botón para volver al inicio. */
export function pintar(contenedor, { titulo }) {
  contenedor.innerHTML = `
    <section class="mx-auto mt-8 max-w-md rounded-2xl bg-white p-8 text-center shadow-sm">
      <p class="text-5xl" aria-hidden="true">🚧</p>
      <h2 class="mt-4 text-xl font-bold"></h2>
      <p class="mt-2 text-slate-600">En construcción. Disponible pronto.</p>
      <a href="#/inicio"
         class="mt-6 inline-block rounded-lg bg-marca px-5 py-3 font-semibold text-white hover:bg-marca/90">
        Volver al inicio
      </a>
    </section>
  `;
  contenedor.querySelector('h2').textContent = titulo; // textContent: nunca se interpreta como HTML.
}
