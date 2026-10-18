/** Curated weight equivalences only. Nutrients always come from the selected TACO food.
 * Exact preparation/name mappings: never infer weights from a substring or use water density.
 * IDs and weights are stable because saved meal plans refer to these IDs.
 */
export interface HouseholdMeasure {
  id: string;
  label: string;
  grams: number;
  source: string;
  sourceUrl: string;
}
const SBD =
  "https://diabetes.org.br/wp-content/uploads/2023/10/manual-contagem-carboidratos2023.pdf";
const IBGE = "https://www.ibge.gov.br/biblioteca/visualizacao/livros/liv50000.pdf";
function sbd(id: string, label: string, grams: number, page: number): HouseholdMeasure {
  return {
    id,
    label: `${label} (≈ ${grams} g)`,
    grams,
    source: `SBD 2023, p. ${page} · peso aproximado da parte comestível`,
    sourceUrl: `${SBD}#page=${page + 1}`,
  };
}
function ibge(id: string, label: string, grams: number, code: string): HouseholdMeasure {
  return {
    id,
    label: `${label} (≈ ${grams} g)`,
    grams,
    source: `IBGE / POF 2008–2009, alimento ${code} · peso aproximado`,
    sourceUrl: IBGE,
  };
}
const apple = [
  ibge("unit", "Unidade média (un)", 150, "6803001"),
  ibge("small-unit", "Unidade pequena (un)", 90, "6803001"),
];
const orange = [
  ibge("unit", "Unidade média, sem casca (un)", 180, "6801801"),
  ibge("small-unit", "Unidade pequena, sem casca (un)", 90, "6801801"),
];
const pear = [ibge("unit", "Unidade média (un)", 130, "6803601")];
const grape = [
  ibge("unit", "Unidade média (un)", 8, "6803901"),
  ibge("small-unit", "Unidade pequena (un)", 4, "6803901"),
];
const yogurt = [
  ibge("pot", "Pote de referência", 200, "7901201"),
  ibge("cup", "Copo médio", 240, "7901201"),
];
export const ADDITIONAL_HOUSEHOLD: Record<string, HouseholdMeasure[]> = {
  "Ovo, de galinha, inteiro, cozido/10minutos": [
    sbd("unit", "Unidade média, sem casca (un)", 45, 134),
  ],
  "Ovo, de galinha, inteiro, cru": [
    ibge("unit", "Unidade média, sem casca (un)", 45, "7803301 / cru"),
  ],
  "Ovo, de galinha, inteiro, frito": [ibge("unit", "Unidade média (un)", 50, "7803301 / frito")],
  "Ovo, de galinha, clara, cozida/10minutos": [sbd("unit", "Clara de uma unidade média", 30, 134)],
  "Ovo, de galinha, gema, cozida/10minutos": [sbd("unit", "Gema de uma unidade média", 15, 134)],
  "Ovo, de codorna, inteiro, cru": [sbd("unit", "Unidade, sem casca (un)", 10, 134)],
  "Pão, trigo, forma, integral": [sbd("slice", "Fatia", 25, 136)],
  "Pão, aveia, forma": [sbd("slice", "Fatia", 25, 136)],
  "Pão, trigo, francês": [sbd("unit", "Unidade (un)", 50, 137)],
  "Pão, de queijo, assado": [
    sbd("small-unit", "Unidade pequena (un)", 20, 172),
    sbd("large-unit", "Unidade super lanche (un)", 90, 137),
  ],
  "Banana, nanica, crua": [sbd("unit", "Unidade média, sem casca (un)", 86, 57)],
  "Banana, da terra, crua": [sbd("large-unit", "Unidade grande, sem casca (un)", 100, 57)],
  "Banana, maçã, crua": [sbd("unit", "Unidade média, sem casca (un)", 65, 57)],
  "Banana, ouro, crua": [sbd("unit", "Unidade média, sem casca (un)", 40, 58)],
  "Banana, prata, crua": [sbd("unit", "Unidade média, sem casca (un)", 40, 58)],
  "Maçã, Argentina, com casca, crua": apple,
  "Maçã, Fuji, com casca, crua": apple,
  "Laranja, baía, crua": orange,
  "Laranja, da terra, crua": orange,
  "Laranja, lima, crua": orange,
  "Laranja, pêra, crua": orange,
  "Pêra, Park, crua": pear,
  "Pêra, Williams, crua": pear,
  "Tangerina, Poncã, crua": [
    ibge("unit", "Unidade média, sem casca (un)", 135, "6802201"),
    ibge("small-unit", "Unidade pequena, sem casca (un)", 100, "6802201"),
  ],
  "Uva, Itália, crua": grape,
  "Uva, Rubi, crua": grape,
  "Morango, cru": [
    ibge("unit", "Unidade média (un)", 12, "6805201"),
    ibge("small-unit", "Unidade pequena (un)", 7, "6805201"),
  ],
  "Abacaxi, cru": [ibge("slice", "Fatia média, sem casca", 75, "6802601")],
  "Mamão, Formosa, cru": [
    sbd("slice", "Fatia média, sem casca/sementes", 100, 123),
    sbd("large-slice", "Fatia grande, sem casca/sementes", 170, 123),
  ],
  "Mamão, Papaia, cru": [
    sbd("half-unit", "Meia unidade, sem casca/sementes", 160, 123),
    sbd("slice", "Fatia média, sem casca/sementes", 100, 123),
  ],
  "Melancia, crua": [sbd("slice", "Fatia média, sem casca", 200, 126)],
  "Melão, cru": [sbd("large-slice", "Fatia grande, sem casca/sementes", 115, 126)],
  "Queijo, minas, frescal": [sbd("slice", "Fatia média", 30, 147)],
  "Queijo, minas, meia cura": [sbd("slice", "Fatia", 30, 146)],
  "Queijo, mozarela": [sbd("slice", "Fatia média", 20, 146)],
  "Queijo, prato": [sbd("slice", "Fatia média", 15, 146)],
  "Queijo, ricota": [sbd("slice", "Fatia média", 35, 146)],
  "Queijo, parmesão": [sbd("slice", "Fatia", 30, 146)],
  "Aveia, flocos, crua": [
    ibge("spoon", "Colher de sopa cheia", 15, "6500401"),
    ibge("teaspoon", "Colher de chá cheia", 2, "6500401"),
  ],
  "Iogurte, natural": [
    ibge("pot", "Pote de referência", 200, "7901204"),
    ibge("spoon", "Colher de sopa rasa", 15, "7901204"),
    ibge("cup", "Copo médio", 240, "7901204"),
  ],
  "Iogurte, natural, desnatado": [
    ibge("pot", "Pote de referência", 200, "7901203"),
    ibge("cup", "Copo médio", 240, "7901203"),
  ],
  "Iogurte, sabor abacaxi": yogurt,
  "Iogurte, sabor morango": yogurt,
  "Iogurte, sabor pêssego": yogurt,
};
