import React, { useState, useEffect } from "react";

/*
  Single-file React demo implementing a simple crafting game per your spec.
  - Drag & drop without external libs (HTML5 DnD)
  - Recipes & resources as in-file JSON (you can move them to .json files)
  - localStorage persistence (inventory, discovered)
  - Crafting 3x3 grid, inventory grid, discovery panel, reset
  - Warm color scheme (pink/bleu), floral emoji placeholders

  How to use:
  1) Create a new CRA / Vite app -> replace src/App.jsx with this file
  2) Add the CSS below into src/index.css or keep as-is
  3) npm start
*/

/* --------- Mocked JSON data (move to files if you want) --------- */
const RESOURCES = [
  { id: "petal", name: "Petal", emoji: "🌸" },
  { id: "leaf", name: "Leaf", emoji: "🍃" },
  { id: "drop", name: "Dew", emoji: "💧" }
];

// recipes: ingredients (list of ids) -> result
const RECIPES = [
  {
    id: "flower_bundle",
    name: "Flower Bundle",
    description: "A small bouquet of petals and leaves.",
    image: "🌺",
    ingredients: ["petal", "petal", "leaf"]
  },
  {
    id: "sparkling_dew",
    name: "Sparkling Dew",
    description: "Potion of shine (final item).",
    image: "✨",
    ingredients: ["drop", "petal", "leaf"]
  }
];

const STORAGE_KEY = "crafting_game_v1";

/* --------- Helper hooks & utils --------- */
function usePersistedState(key, initial) {
  const [state, setState] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : initial;
    } catch (e) {
      return initial;
    }
  });
  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(state));
  }, [key, state]);
  return [state, setState];
}

function countItems(list) {
  return list.reduce((acc, id) => {
    acc[id] = (acc[id] || 0) + 1;
    return acc;
  }, {});
}

function matchRecipe(gridItems, recipe) {
  const gridCounts = countItems(gridItems.filter(Boolean));
  const reqCounts = countItems(recipe.ingredients);
  for (let k of Object.keys(reqCounts)) {
    if (!gridCounts[k] || gridCounts[k] < reqCounts[k]) return false;
  }
  // Also ensure no extra non-empty items that aren't part of recipe? allow extras - we'll require exact match of counts
  const totalReq = recipe.ingredients.length;
  const totalGrid = gridItems.filter(Boolean).length;
  return totalGrid === totalReq;
}

/* --------- Styles (basic inline + class names) --------- */
const styles = {
  app: {
    fontFamily: "Inter, Roboto, sans-serif",
    padding: 20,
    background: "linear-gradient(120deg,#fffaf6,#f3fbff)",
    minHeight: "100vh"
  },
  header: { fontSize: 32, marginBottom: 12, color: "#1f2937" },
  layout: { display: "grid", gridTemplateColumns: "220px 1fr 240px", gap: 16, alignItems: "start" },
  panel: { background: "#fff", borderRadius: 12, padding: 12, boxShadow: "0 6px 18px rgba(0,0,0,0.06)" },
  resourceItem: { padding: 10, borderRadius: 8, margin: 8, cursor: "grab", display: "flex", gap: 8, alignItems: "center", background: "#fff7fb", border: "1px solid #ffeef6" },
  inventoryGrid: { display: "grid", gridTemplateColumns: "repeat(6,56px)", gap: 8, padding: 12, justifyContent: "center" },
  slot: { width: 56, height: 56, borderRadius: 8, background: "#f6f2f8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, border: "1px dashed #e6d6e9" },
  craftGrid: { display: "grid", gridTemplateColumns: "repeat(3,84px)", gap: 8, justifyContent: "center", padding: 16, background: "#fffaf1", borderRadius: 12 }
};

/* --------- Main App --------- */
export default function App() {
  // inventory: array of item ids or null (fixed sized)
  const [inventory, setInventory] = usePersistedState(STORAGE_KEY, {
    inv: Array(18).fill(null),
    discovered: {},
    finalCrafted: false
  });

  // crafting grid: 9 slots
  const [craftGrid, setCraftGrid] = useState(Array(9).fill(null));

  // drag state: id of dragged item and source (inv index | 'palette' | 'craft')
  const [dragData, setDragData] = useState(null);

  // computed preview recipe
  const possibleRecipe = RECIPES.find((r) => matchRecipe(craftGrid, r)) || null;

  useEffect(() => {
    // keep inventory shape if older data
    if (!inventory.inv) setInventory((s) => ({ ...s, inv: Array(18).fill(null) }));
    // eslint-disable-next-line
  }, []);

  /* --------- Palette actions (generate resource) --------- */
  function addResourceToFirstSlot(id) {
    const slot = inventory.inv.findIndex((x) => x === null);
    if (slot === -1) return; // full
    const newInv = [...inventory.inv];
    newInv[slot] = id;
    setInventory({ ...inventory, inv: newInv });
  }

  /* --------- Drag & Drop Handlers --------- */
  function onDragStart(e, payload) {
    setDragData(payload);
    e.dataTransfer.setData("text/plain", JSON.stringify(payload));
    // show move cursor
    e.dataTransfer.effectAllowed = "move";
  }

  function onDropToInv(e, targetIndex) {
    e.preventDefault();
    const payload = dragData || JSON.parse(e.dataTransfer.getData("text/plain") || "null");
    if (!payload) return;
    const newInv = [...inventory.inv];

    // if dragging from palette -> place into target slot (if empty)
    if (payload.source === "palette") {
      if (newInv[targetIndex] !== null) return; // occupied
      newInv[targetIndex] = payload.id;
      setInventory({ ...inventory, inv: newInv });
      return;
    }

    // from inventory -> swap
    if (payload.source === "inv") {
      const from = payload.index;
      // swap or move
      newInv[targetIndex] = newInv[from];
      newInv[from] = null;
      setInventory({ ...inventory, inv: newInv });
      return;
    }

    // from craft -> move back to inventory
    if (payload.source === "craft") {
      if (newInv[targetIndex] !== null) return;
      newInv[targetIndex] = craftGrid[payload.index];
      const newCraft = [...craftGrid];
      newCraft[payload.index] = null;
      setInventory({ ...inventory, inv: newInv });
      setCraftGrid(newCraft);
      return;
    }
  }

  function onDropToCraft(e, targetIndex) {
    e.preventDefault();
    const payload = dragData || JSON.parse(e.dataTransfer.getData("text/plain") || "null");
    if (!payload) return;
    const newCraft = [...craftGrid];
    // from palette -> put if empty
    if (payload.source === "palette") {
      if (newCraft[targetIndex] !== null) return;
      newCraft[targetIndex] = payload.id;
      setCraftGrid(newCraft);
      return;
    }
    // from inv -> move
    if (payload.source === "inv") {
      const from = payload.index;
      if (newCraft[targetIndex] !== null) return;
      newCraft[targetIndex] = inventory.inv[from];
      const newInv = [...inventory.inv];
      newInv[from] = null;
      setInventory({ ...inventory, inv: newInv });
      setCraftGrid(newCraft);
      return;
    }

    // swap craft slots
    if (payload.source === "craft") {
      const from = payload.index;
      newCraft[targetIndex] = craftGrid[from];
      newCraft[from] = craftGrid[targetIndex];
      setCraftGrid(newCraft);
      return;
    }
  }

  function onDeleteInv(index) {
    const newInv = [...inventory.inv];
    newInv[index] = null;
    setInventory({ ...inventory, inv: newInv });
  }

  /* --------- Crafting actions --------- */
  function confirmCraft() {
    if (!possibleRecipe) return;
    // remove required ingredients from craftGrid (simple greedy remove)
    const req = [...possibleRecipe.ingredients];
    const newCraft = [...craftGrid];
    for (let i = 0; i < newCraft.length; i++) {
      if (!newCraft[i]) continue;
      const idx = req.indexOf(newCraft[i]);
      if (idx !== -1) {
        req.splice(idx, 1);
        newCraft[i] = null;
      }
    }
    // add result to first free inventory slot
    const invCopy = [...inventory.inv];
    const free = invCopy.findIndex((x) => x === null);
    if (free === -1) {
      alert("Inventarul este plin. Eliberați un slot.");
      return;
    }
    invCopy[free] = possibleRecipe.id;

    // mark discovered
    const discovered = { ...inventory.discovered };
    discovered[possibleRecipe.id] = true;

    // set final crafted if recipe is final (let's treat the last recipe as final)
    const finalCrafted = inventory.finalCrafted || possibleRecipe.id === RECIPES[RECIPES.length - 1].id;

    setInventory({ inv: invCopy, discovered, finalCrafted });
    setCraftGrid(newCraft);
  }

  function canCraftWithResources() {
    // return recipes that can be built with current discovered resources in inventory + craft
    const available = [...inventory.inv, ...craftGrid].filter(Boolean);
    const availCounts = countItems(available);
    return RECIPES.filter((r) => {
      const req = countItems(r.ingredients);
      for (let k of Object.keys(req)) {
        if (!availCounts[k] || availCounts[k] < req[k]) return false;
      }
      return true;
    });
  }

  function resetGame() {
    if (!confirm("Reset game? Progresul se va pierde.")) return;
    localStorage.removeItem(STORAGE_KEY);
    setInventory({ inv: Array(18).fill(null), discovered: {}, finalCrafted: false });
    setCraftGrid(Array(9).fill(null));
  }

  /* --------- Render helpers --------- */
  function renderItem(id) {
    // id could be resource id or crafted id
    const res = RESOURCES.find((r) => r.id === id);
    if (res) return (
      <div style={{ textAlign: "center" }}>
        <div>{res.emoji}</div>
        <div style={{ fontSize: 10 }}>{res.name}</div>
      </div>
    );
    const rec = RECIPES.find((r) => r.id === id);
    if (rec) return (
      <div style={{ textAlign: "center" }}>
        <div>{rec.image}</div>
        <div style={{ fontSize: 10 }}>{rec.name}</div>
      </div>
    );
    return null;
  }

  /* --------- JSX --------- */
  return (
    <div style={styles.app}>
      <div style={styles.header}>Crearea unui Joc de Crafting — demo</div>
      <div style={styles.layout}>
        {/* Resources palette */}
        <div style={{ ...styles.panel }}> 
          <h3 style={{ marginTop: 0 }}>Resurse (infinite)</h3>
          {RESOURCES.map((r) => (
            <div key={r.id} style={styles.resourceItem}
              draggable
              onDragStart={(e) => onDragStart(e, { source: "palette", id: r.id })}
              onClick={() => addResourceToFirstSlot(r.id)}
            >
              <div style={{ fontSize: 26 }}>{r.emoji}</div>
              <div>
                <div style={{ fontWeight: 600 }}>{r.name}</div>
                <div style={{ fontSize: 12, color: "#7a7a7a" }}>Apasă sau trage în inventar</div>
              </div>
            </div>
          ))}
          <hr />
          <div style={{ marginTop: 8 }}>
            <button onClick={() => { setInventory({ ...inventory, inv: Array(18).fill(null) }); setCraftGrid(Array(9).fill(null)); }} style={{ marginRight: 8 }}>Clear Inventory</button>
            <button onClick={resetGame} style={{ background: "#ef476f", color: "white", border: "none", padding: "6px 10px", borderRadius: 6 }}>Reset Game</button>
          </div>
        </div>

        {/* Center: Crafting + Inventory */}
        <div>
          <div style={{ ...styles.panel, marginBottom: 12, textAlign: "center" }}>
            <h4 style={{ margin: 0 }}>Crafting</h4>
            <div style={{ marginTop: 12 }}>
              <div style={styles.craftGrid}>
                {craftGrid.map((slot, i) => (
                  <div key={i}
                    style={styles.slot}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => onDropToCraft(e, i)}
                    draggable={false}
                    onDragEnter={() => {}}
                  >
                    {slot ? (
                      <div draggable onDragStart={(e) => onDragStart(e, { source: "craft", index: i })}>
                        {renderItem(slot)}
                      </div>
                    ) : (
                      <div style={{ color: "#c6c6c6" }}>—</div>
                    )}
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 12 }}>
                {possibleRecipe ? (
                  <div style={{ display: "flex", gap: 12, alignItems: "center", justifyContent: "center" }}>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 34 }}>{possibleRecipe.image}</div>
                      <div style={{ fontWeight: 700 }}>{possibleRecipe.name}</div>
                      <div style={{ fontSize: 12 }}>{possibleRecipe.description}</div>
                    </div>
                    <button onClick={confirmCraft} style={{ padding: "8px 12px", borderRadius: 8, background: "#42b883", color: "white", border: "none" }}>Craft</button>
                  </div>
                ) : (
                  <div style={{ color: "#8b8b8b", textAlign: "center" }}>Nicio rețetă validă</div>
                )}
              </div>
            </div>
          </div>

          <div style={{ ...styles.panel }}>
            <h4 style={{ marginTop: 0 }}>Inventar</h4>
            <div style={styles.inventoryGrid}
              onDragOver={(e) => e.preventDefault()}
            >
              {inventory.inv.map((it, i) => (
                <div key={i} style={{ position: "relative" }}
                  onDrop={(e) => onDropToInv(e, i)}
                >
                  <div style={styles.slot}>
                    {it ? (
                      <div draggable onDragStart={(e) => onDragStart(e, { source: "inv", index: i })}>
                        {renderItem(it)}
                      </div>
                    ) : (
                      <div style={{ color: "#c6c6c6" }}>+</div>
                    )}
                  </div>
                  {it && (
                    <button onClick={() => onDeleteInv(i)} style={{ position: "absolute", right: -6, top: -6, fontSize: 11, padding: "2px 6px", borderRadius: 8 }}>x</button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Discovery panel */}
        <div style={styles.panel}>
          <h4 style={{ marginTop: 0 }}>Descoperiri</h4>
          <div>
            {RECIPES.map((r) => (
              <div key={r.id} style={{ display: "flex", gap: 8, alignItems: "center", padding: 8, borderRadius: 8, background: inventory.discovered[r.id] ? "#fff7ed" : "#fff" , marginBottom: 8 }}>
                <div style={{ fontSize: 22 }}>{r.image}</div>
                <div>
                  <div style={{ fontWeight: 700 }}>{r.name}</div>
                  <div style={{ fontSize: 12, color: "#666" }}>{inventory.discovered[r.id] ? r.description : "???"}</div>
                </div>
                <div style={{ marginLeft: "auto", fontSize: 12, color: inventory.discovered[r.id] ? "#2a9d8f" : "#c44" }}>{inventory.discovered[r.id] ? "Descoperit" : "Necunoscut"}</div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 12 }}>
            <h5>Ce poți crea acum</h5>
            {canCraftWithResources().length ? (
              canCraftWithResources().map((r) => (
                <div key={r.id} style={{ padding: 8, borderRadius: 8, marginBottom: 6, background: "#f7fbff" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ fontSize: 20 }}>{r.image}</div>
                    <div>
                      <div style={{ fontWeight: 700 }}>{r.name}</div>
                      <div style={{ fontSize: 12 }}>{r.description}</div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div style={{ color: "#888" }}>Nimic momentan</div>
            )}
          </div>

          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 13 }}>Progres: {Object.keys(inventory.discovered).length} / {RECIPES.length}</div>
            {inventory.finalCrafted && <div style={{ marginTop: 8, padding: 8, borderRadius: 8, background: "#fff3f0", color: "#b00020" }}>Felicitări — obiectul final a fost creat!</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
