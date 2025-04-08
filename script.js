let lastCode = "";

function estProduitUS(tagsPays, fabrication, origine, marque, code, isWikidataUS) {
    const tous = (tagsPays || []).concat(fabrication || "", origine || "", marque || "").join(" ").toLowerCase();
    const eanPrefix = code ? code.slice(0, 3) : "";
    const eanUS = ["000", "001", "002", "003", "004", "005", "006", "007", "008", "009"].includes(eanPrefix);
    return tous.includes("united-states") || tous.includes("usa") ||
            tous.includes("etats-unis") || tous.includes("american") ||
            eanUS || isWikidataUS
        ? "Oui"
        : "Non";
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

async function verifierWikidataMarqueMultiple(marques) {
    const requetes = marques.map(async (marque) => {
        const query = `
            PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
            PREFIX wdt: <http://www.wikidata.org/prop/direct/>
            PREFIX wd: <http://www.wikidata.org/entity/>
            SELECT ?countryLabel WHERE {
            ?brand rdfs:label "${marque}"@en;
                    wdt:P17 ?country;
                    wdt:P31 ?type.
            FILTER(?type IN (
                wd:Q18536338,  # food brand
                wd:Q15711449,  # brand of food product
                wd:Q167270     # generic brand
            ))
            SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
            }
            LIMIT 1
        `;

        const url = "https://query.wikidata.org/sparql?query=" + encodeURIComponent(query);
        try {
            const res = await fetch(url, {
            headers: { 'Accept': 'application/sparql-results+json' },
            });
    
            if (!res.ok) return false;
    
            const json = await res.json();
            const result = json?.results?.bindings?.[0];
            if (!result) return false;
    
            const country = result.countryLabel.value.toLowerCase();
            console.log(`Résultat pour ${marque} :`, country);
            return country.includes("united states") || country.includes("usa");
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
        constraints: {
        facingMode: "environment"
        }
    },
    decoder: {
        readers: ["ean_reader"]
    }
}, function(err) {
    if (err) {
        console.error(err);
        return;
    }
    Quagga.start();
});
Quagga.onDetected(async data => {
    const code = data.codeResult.code;
    if (code !== lastCode) {
        lastCode = code;
        fetch(`https://world.openfoodfacts.org/api/v0/product/${code}.json`)
        .then(res => res.json())
        .then(async data => {
            if (data.status === 1) {
            const prod = data.product;
            console.log(prod)
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
            const resultHTML = `
                <div class="product-result ${isUS === "Oui" ? "danger_background" : ""}" >
                    <div class="display-infos-product">
                        <div class="product-image">
                            <img src="${image}" alt="${name}" />
                        </div>
                        <div class="infos-prod-text">
                            <p class="text-display-style"><span class="title-text">Code :</span><span class="result-text">${code}</span></p>
                            <p class="text-display-style"><span class="title-text">Nom :</span><span class="result-text">${name}</span></p>
                            <p class="text-display-style"><span class="title-text">Pays :</span><span class="result-text">${countries.join(", ") || "Non spécifié"}</span></p>
                            <p class="text-display-style"><span class="title-text">Fabriqué en :</span><span class="result-text">${manu}</span></p>
                            <p class="text-display-style"><span class="title-text">Origine(s) :</span><span class="result-text">${origins}</span></p>
                            <p class="text-display-style"><span class="title-text">Marque :</span><span class="result-text">${brand}</span></p>
                            <p class="text-display-style"><span class="title-text">Produit américain ?</span>
                                <span class="result-text">
                                    <span class="${isUS === "Oui" ? "highlight-yes" : "highlight-no"}">${isUS}</span>
                                    <span class="us-flag">
                                        ${isUS === "Oui" ? "🇺🇸" : ""}
                                    </span>
                                </span>
                            </p>
                            <span class="${isUS === "Oui" ? "display_rom" : "hide_rom"}">
                                <img src="https://devxr.fr/scan/assets/romain.webp" alt="Romain B approuve! "/>
                            </span>
                        </div>
                    </div>
                    ${warning ? `<p class="warning">${warning}</p>` : ""}
                </div>`;
            const resultsDiv = document.getElementById("results");
            resultsDiv.insertAdjacentHTML("afterbegin", resultHTML);
            }
        })
        .catch(err => {
            console.error(err);
            const resultsDiv = document.getElementById("results");
            const errorHTML = `
            <div class="product-result">
                <div class="display-infos-product">
                <div class="infos-prod-text" style="margin: auto; text-align: center;">
                    <p class="text-display-style">
                    <span class="title-text">Erreur de récupération du produit.</span>
                    </p>
                </div>
                </div>
            </div>`;
            resultsDiv.insertAdjacentHTML("afterbegin", errorHTML);
        });
    }
});