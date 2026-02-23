// src/components/CharactersTable.jsx
import { API_URL } from '../api.js';
import { useState, useMemo } from "react";

export default function CharactersTable({ characters, attributes, gameId, imagePath }) {
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState("name");
  const [sortAsc, setSortAsc] = useState(true);
  const [page, setPage] = useState(0);

  const PAGE_SIZE = 15;

  // ⭐ Chemin d'image dynamique
  const imageBasePath = imagePath ? `${API_URL}/api/images/${imagePath}/${gameId}` : `${API_URL}/api/images/${gameId}`;

  // Colonnes dynamiques basées sur les attributs
  const columns = [
    { key: "image", label: "Image" },
    { key: "name", label: "Name" },
    ...attributes.map(attr => ({ key: attr.key, label: attr.label }))
  ];

  // FILTRE
  const filtered = useMemo(() => {
    return characters.filter((c) =>
      c.name.toLowerCase().includes(search.toLowerCase())
    );
  }, [characters, search]);

  // TRI INTELLIGENT
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let va = a[sortField] || "";
      let vb = b[sortField] || "";

      // Trouver l'attribut correspondant pour connaître son type
      const attr = attributes.find(attr => attr.key === sortField);

      // Si c'est un type ordered, utiliser l'ordre défini
      if (attr && attr.type === "ordered" && attr.order) {
        const indexA = attr.order.findIndex(item => item.toLowerCase() === va.toString().toLowerCase());
        const indexB = attr.order.findIndex(item => item.toLowerCase() === vb.toString().toLowerCase());
        
        // Mettre les valeurs non trouvées à la fin
        if (indexA === -1 && indexB === -1) return 0;
        if (indexA === -1) return 1;
        if (indexB === -1) return -1;
        
        return sortAsc ? indexA - indexB : indexB - indexA;
      }

      // Si c'est un type number, convertir en nombre
      if (attr && attr.type === "number") {
        const numA = Number(va);
        const numB = Number(vb);
        
        if (isNaN(numA) && isNaN(numB)) return 0;
        if (isNaN(numA)) return 1;
        if (isNaN(numB)) return -1;
        
        return sortAsc ? numA - numB : numB - numA;
      }

      // Sinon, tri alphabétique standard
      va = va.toString().toLowerCase();
      vb = vb.toString().toLowerCase();

      if (va < vb) return sortAsc ? -1 : 1;
      if (va > vb) return sortAsc ? 1 : -1;
      return 0;
    });
  }, [filtered, sortField, sortAsc, attributes]);

  // PAGINATION
  const pages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const visible = sorted.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  function handleSort(field) {
    if (field === sortField) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  }

  return (
    <div>
      {/* BARRE DE RECHERCHE */}
      <div className="search-bar">
        <input
          className="search-input"
          placeholder="Search character by name..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
        />
      </div>

      {/* TABLEAU */}
      <div className="table-wrapper">
        <table className="characters-table">
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  onClick={() => col.key !== "image" && handleSort(col.key)}
                  style={{ cursor: col.key === "image" ? "default" : "pointer" }}
                >
                  {col.label}
                  {sortField === col.key && (sortAsc ? " ▲" : " ▼")}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {visible.map((c) => (
              <tr key={c.id}>
                {/* IMAGE - ⭐ CHEMIN CORRIGÉ */}
                <td>
                  <img
                    src={`${imageBasePath}/characters/${c.image}`}
                    alt={c.name}
                    className="character-image"
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                </td>

                {/* NOM */}
                <td><strong>{c.name}</strong></td>

                {/* ATTRIBUTS DYNAMIQUES */}
                {attributes.map((attr) => (
                  <td key={attr.key}>
                    {attr.key === "affiliation" || attr.key === "firstArc" ? (
                      <span className="badge">
                        {c[attr.key] || "—"}
                      </span>
                    ) : (
                      c[attr.key] || "—"
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* PAGINATION */}
      <div className="pagination">
        <button
          disabled={page === 0}
          onClick={() => setPage(page - 1)}
          className="pagination-btn"
        >
          ‹ Prev
        </button>

        <div className="pagination-info">
          Page {page + 1} / {pages}
        </div>

        <button
          disabled={page === pages - 1}
          onClick={() => setPage(page + 1)}
          className="pagination-btn"
        >
          Next ›
        </button>
      </div>
    </div>
  );
}