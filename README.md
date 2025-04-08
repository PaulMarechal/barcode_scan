# 🇺🇸 US or not US – Scanner de produits alimentaires

Cette application web permet de scanner un produit (via son code-barres) et de déterminer s'il est **américain ou non** 🇺🇸. Elle s’appuie sur l’API OpenFoodFacts et Wikidata pour récupérer et croiser des infos sur la marque, le pays de fabrication, etc.

## 🎯 Fonctionnalités

- 📷 Scan en temps réel avec la caméra du téléphone (via QuaggaJS)
- 🔎 Affiche les infos essentielles du produit scanné
- 🇺🇸 Détermine si un produit est américain via plusieurs sources :
  - Préfixe EAN (code-barres)
  - Pays de distribution, de fabrication ou d’origine
  - Wikidata (origine de la marque)
- ⚠️ Avertissement si certaines infos sont manquantes
- ⚙️ **Bouton "Modifier"** pour choisir les infos à afficher (ex. allergènes, additifs, NOVA, Nutri-score…)
- 💾 Les préférences utilisateur sont **enregistrées dans les cookies**

## 📦 Technologies utilisées

- HTML/CSS/JS vanilla
- [QuaggaJS](https://github.com/ericblade/quagga2) – pour la lecture du code-barres
- [OpenFoodFacts API](https://world.openfoodfacts.org/data) – données produits
- [Wikidata SPARQL](https://query.wikidata.org/) – origine de la marque

## 📂 Structure du projet
📁 /project-root │ 
├── index.html # Fichier principal 
├── style.css # Styles CSS 
├── script.js # Logique de scan + affichage 
└── README.md # Ce fichier


## ✅ À faire

- [ ] Ajouter la détection d'autres pays (🇫🇷, 🇩🇪...)
- [ ] Ajouter un indicateur "EcoScore"
- [ ] Système de favoris ou historique des scans

## ✨ Exemple de rendu

<img src="https://devxr.fr/scan/assets/demo-scan.png" alt="Demo US or not US" width="300"/>

## 🧠 Crédits

Projet créé par [paul Maréchal - DevXR] – données issues de sources ouvertes (OpenFoodFacts + Wikidata).

---

**PS :** Ce projet est 100% local et ne stocke **aucune donnée utilisateur** à part les préférences dans les cookies.

