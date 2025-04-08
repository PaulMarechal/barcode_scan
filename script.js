const FIELDS = [
    { id: 'code', label: 'Code', defaultVisible: false },
    { id: 'name', label: 'Nom', defaultVisible: true },
    { id: 'countries', label: 'Pays', defaultVisible: true },
    { id: 'manu', label: 'Fabriqué en', defaultVisible: true },
    { id: 'origins', label: 'Origine(s)', defaultVisible: true },
    { id: 'brand', label: 'Marque', defaultVisible: true },
    { id: 'us', label: 'Produit américain ?', defaultVisible: true },
    { id: 'allergens', label: 'Allergènes', defaultVisible: false },
    { id: 'additives', label: 'Additifs', defaultVisible: false },
    { id: 'controversial', label: 'Ingrédients controversés', defaultVisible: false },
    { id: 'nova', label: 'Score NOVA', defaultVisible: false },
    { id: 'nutriscore', label: 'Nutri-Score', defaultVisible: false },
    { id: 'indicators', label: 'Indicateurs (sucre, huile de palme, etc.)', defaultVisible: false }
];
  
function getPreferences() {
    const prefs = localStorage.getItem("usor_settings");
    if (prefs) return JSON.parse(prefs);
    return FIELDS.filter(f => f.defaultVisible).map(f => f.id);
}
  
function setPreferences(selectedFields) {
    localStorage.setItem("usor_settings", JSON.stringify(selectedFields));
}

let lastCode = "";

// Find user pref into cookies 
function getUserSettings() {
    const saved = localStorage.getItem("userSettings");
    return saved ? JSON.parse(saved) : {
        calories: false,
        additifs: false,
        allergenes: false,
        eco: false,
    };
}

function saveUserSettings(settings) {
    localStorage.setItem("userSettings", JSON.stringify(settings));
}

function applySettingsToProduct(prod, settings) {
    const extras = [];
    if (settings.calories && prod.nutriments?.energy_kcal) {
        extras.push(`<p class="text-display-style"><span class="title-text">Calories :</span><span class="result-text">${prod.nutriments.energy_kcal} kcal</span></p>`);
    }
    if (settings.additifs && prod.additives_tags?.length) {
        extras.push(`<p class="text-display-style"><span class="title-text">Additifs :</span><span class="result-text">${prod.additives_tags.join(", ")}</span></p>`);
    }
    if (settings.allergenes && prod.allergens_tags?.length) {
        extras.push(`<p class="text-display-style"><span class="title-text">Allergènes :</span><span class="result-text">${prod.allergens_tags.join(", ")}</span></p>`);
    }
    if (settings.eco && prod.ecoscore_data?.adjustments?.carbon_footprint?.value) {
        extras.push(`<p class="text-display-style"><span class="title-text">Empreinte carbone :</span><span class="result-text">${prod.ecoscore_data.adjustments.carbon_footprint.value} g CO₂</span></p>`);
    }
    return extras.join("\n");
}

function afficherWarning(prod) {
    const champsVides = [];
    if (!prod.product_name && !prod.product_name_es && !prod.product_name_fr) champsVides.push("nom du produit");
    if (!prod.countries_tags || prod.countries_tags.length === 0) champsVides.push("pays de distribution");
    if (!prod.manufacturing_places) champsVides.push("lieu de fabrication");
    if (!prod.origins_tags || prod.origins_tags.length === 0) champsVides.push("origine");
    if (!prod.brands) champsVides.push("marque");
    return champsVides.length ? `⚠️ Informations manquantes ou incomplètes : ${champsVides.join(", ")}` : "";
}

function estProduitUS(tagsPays, fabrication, origine, marque, code, isWikidataUS) {
    const tous = (tagsPays || []).concat(fabrication || "", origine || "", marque || "").join(" ").toLowerCase();
    const eanPrefix = code ? code.slice(0, 3) : "";
    const eanUS = ["000", "001", "002", "003", "004", "005", "006", "007", "008", "009"].includes(eanPrefix);
    return tous.includes("united-states") || tous.includes("usa") ||
        tous.includes("etats-unis") || tous.includes("american") ||
        eanUS || isWikidataUS ? "Oui" : "Non";
}

async function verifierWikidataMarqueMultiple(marques) {
    const requetes = marques.map(async (marque) => {
        const query = `PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        PREFIX wdt: <http://www.wikidata.org/prop/direct/>
        PREFIX wd: <http://www.wikidata.org/entity/>
        SELECT ?countryLabel WHERE {
            ?brand rdfs:label "${marque}"@en;
                wdt:P17 ?country;
                wdt:P31 ?type.
            FILTER(?type IN (
            wd:Q18536338,
            wd:Q15711449,
            wd:Q167270
            ))
            SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
        } LIMIT 1`;

        const url = "https://query.wikidata.org/sparql?query=" + encodeURIComponent(query);
        try {
        const res = await fetch(url, { headers: { 'Accept': 'application/sparql-results+json' } });
        if (!res.ok) return false;
        const json = await res.json();
        const result = json?.results?.bindings?.[0];
        return result ? result.countryLabel.value.toLowerCase().includes("united states") : false;
        } catch (err) {
        console.warn("Erreur Wikidata:", err);
        return false;
        }
    });
    const results = await Promise.all(requetes);
    return results.includes(true);
}

Quagga.init({
    inputStream: {
        type: "LiveStream",
        target: document.querySelector("#scanner-container"),
        constraints: { facingMode: "environment" }
    },
    decoder: { readers: ["ean_reader"] }
    }, err => {
        if (err) return console.error(err);
    Quagga.start();
});

Quagga.onDetected(async data => {
    const code = data.codeResult.code;
    if (code !== lastCode) {
        lastCode = code;
        const settings = getUserSettings();
        fetch(`https://world.openfoodfacts.org/api/v0/product/${code}.json`)
        .then(res => res.json())
        .then(async data => {
            if (data.status === 1) {
                const prod = data.product;
                const name = prod.product_name || prod.product_name_es || "Nom non spécifié";
                const manu = prod.manufacturing_places || "Non spécifié";
                const countries = prod.countries_tags || [];
                const image = prod.image_front_url || "";
                const origins = prod.origins_tags ? prod.origins_tags.join(", ") : "Non spécifié";
                const brand = prod.brands || "Non spécifiée";
                const brandsList = brand.split(",").map(b => b.trim());
                const isBrandFromUS = await verifierWikidataMarqueMultiple(brandsList);
                const isUS = estProduitUS(countries, manu, origins, brand, code, isBrandFromUS);
                const warning = afficherWarning(prod);
                const extrasHTML = applySettingsToProduct(prod, settings);

                const selectedFields = getPreferences();

                let infosHTML = "";

                if (selectedFields.includes("code"))
                infosHTML += `<p class="text-display-style"><span class="title-text">Code :</span><span class="result-text">${code}</span></p>`;
                if (selectedFields.includes("name"))
                infosHTML += `<p class="text-display-style"><span class="title-text">Nom :</span><span class="result-text">${name}</span></p>`;
                if (selectedFields.includes("countries"))
                infosHTML += `<p class="text-display-style"><span class="title-text">Pays :</span><span class="result-text">${countries.join(", ") || "Non spécifié"}</span></p>`;
                if (selectedFields.includes("manu"))
                infosHTML += `<p class="text-display-style"><span class="title-text">Fabriqué en :</span><span class="result-text">${manu}</span></p>`;
                if (selectedFields.includes("origins"))
                infosHTML += `<p class="text-display-style"><span class="title-text">Origine(s) :</span><span class="result-text">${origins}</span></p>`;
                if (selectedFields.includes("brand"))
                infosHTML += `<p class="text-display-style"><span class="title-text">Marque :</span><span class="result-text">${brand}</span></p>`;
                if (selectedFields.includes("us"))
                infosHTML += `<p class="text-display-style"><span class="title-text">Produit américain ?</span>
                    <span class="result-text">
                    <span class="${isUS === "Oui" ? "highlight-yes" : "highlight-no"}">${isUS}</span>
                    <span class="us-flag">${isUS === "Oui" ? "🇺🇸" : ""}</span>
                    </span></p>`;
                if (selectedFields.includes("allergens"))
                    infosHTML += `<p class="text-display-style"><span class="title-text">Allergènes :</span><span class="result-text">${prod.allergens || "Non spécifié"}</span></p>`;
                
                if (selectedFields.includes("additives"))
                    infosHTML += `<p class="text-display-style"><span class="title-text">Additifs :</span><span class="result-text">${(prod.additives_tags || []).join(", ") || "Aucun"}</span></p>`;
                
                if (selectedFields.includes("controversial"))
                    infosHTML += `<p class="text-display-style"><span class="title-text">Controversés :</span><span class="result-text">${prod.ingredients_analysis_tags?.join(", ") || "Non détecté"}</span></p>`;
                
                if (selectedFields.includes("nova"))
                    infosHTML += `<p class="text-display-style"><span class="title-text">NOVA :</span><span class="result-text">${prod.nova_group || "Non disponible"}</span></p>`;
                
                if (selectedFields.includes("nutriscore"))
                    infosHTML += `<p class="text-display-style"><span class="title-text">Nutri-Score :</span><span class="result-text">${prod.nutriscore_grade?.toUpperCase() || "Non disponible"}</span></p>`;
                
                if (selectedFields.includes("indicators")) {
                    const levels = prod.nutrient_levels || {};
                    const indicators = Object.entries(levels)
                    .map(([k, v]) => `${k} (${v})`)
                    .join(", ");
                    infosHTML += `<p class="text-display-style"><span class="title-text">Indicateurs :</span><span class="result-text">${indicators || "Non dispo"}</span></p>`;
                }
                    

                const resultHTML = `
                <div class="product-result ${isUS === "Oui" ? "danger_background" : ""}" >
                    <div class="display-infos-product">
                    <div class="product-image">
                        <img src="${image}" alt="${name}" />
                    </div>
                    <div class="infos-prod-text">
                        ${infosHTML}
                        <span class="${isUS === "Oui" ? "display_rom" : "hide_rom"}">
                        <img src="https://devxr.fr/scan/assets/romain.webp" alt="Romain B approuve! "/>
                        </span>
                    </div>
                    </div>
                    ${warning ? `<p class="warning">${warning}</p>` : ""}
                </div>`;

                document.getElementById("results").insertAdjacentHTML("afterbegin", resultHTML);
            }
        });
    }
});

// Selectors for modale display and cookies
const openBtn = document.getElementById("open-settings");
const closeBtn = document.getElementById("close-settings");
const modal = document.getElementById("modal-settings");
const form = document.getElementById("settings-form");

// Display modale ( with differents choices )
openBtn.addEventListener("click", () => {
    modal.classList.remove("hidden");
    const currentPrefs = getPreferences();
    form.innerHTML = FIELDS.map(f => {
        const checked = currentPrefs.includes(f.id) ? "checked" : "";
        return `<label><input type="checkbox" name="${f.id}" ${checked}/> ${f.label}</label>`;
    }).join("") + `<button type="submit">Enregistrer</button>`;
});

// Close modale
closeBtn.addEventListener("click", () => {
    modal.classList.add("hidden");
});

// Save pref 
form.addEventListener("submit", e => {
    e.preventDefault();
    const formData = new FormData(form);
    const checked = FIELDS.map(f => f.id).filter(id => formData.get(id) === "on");
    setPreferences(checked);
    modal.classList.add("hidden");
});
