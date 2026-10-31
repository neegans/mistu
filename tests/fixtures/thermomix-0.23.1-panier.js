// Plan produit et relu par le vrai code 0.23.1 : panier chargé ignoré par le couteau.
// Aucune signature moderne fabriquée ni reconstruction au chargement de la fixture.
export const ORIGINE_PANIER_THERMOMIX_HISTORIQUE = Object.freeze({
  "commit": "752566d02a3bdddf6ec7a7afeae5d9280f3cc3d5",
  "version": "0.23.1",
  "blob_thermomix": "4ea95a08e6c9f1c487af3499b1c6bf89f6316d00",
  "sha256": "4a90b07ba2fd8e1f83266c7fbb13878b7966e7adb39e93900c3203c4bfff6f06"
});
const FIXTURE = {
  "original": {
    "id": "rv-historique-panier-source",
    "recipe_id": "recette-historique-panier",
    "kind": "extraction",
    "status": null,
    "servings": 4,
    "prep_minutes": 10,
    "cook_minutes": 20,
    "total_minutes": 30,
    "active_minutes": 12,
    "ingredients": [
      {
        "id": "ri-tomate",
        "source_text": "400 g de tomates",
        "name_text": "tomates",
        "quantity": {
          "value": 400,
          "raw": "400"
        },
        "unit_id": "g"
      },
      {
        "id": "ri-oignon",
        "source_text": "100 g d’oignons",
        "name_text": "oignons",
        "quantity": {
          "value": 100,
          "raw": "100"
        },
        "unit_id": "g"
      }
    ],
    "steps": [
      {
        "id": "s1",
        "text": "Préparer les tomates et les oignons."
      },
      {
        "id": "s2",
        "text": "Faire cuire la sauce."
      },
      {
        "id": "s3",
        "text": "Servir avec les pâtes."
      }
    ],
    "constraints": {
      "diets": [
        "vegetarien"
      ]
    },
    "provenance": {
      "source_page_ids": [],
      "convention_snapshot": {
        "id": "metric_ca",
        "revision": 1
      }
    }
  },
  "version": {
    "id": "rv-historique-panier",
    "recipe_id": "recette-historique-panier",
    "kind": "adaptation",
    "status": "proposed",
    "servings": 4,
    "prep_minutes": null,
    "cook_minutes": null,
    "total_minutes": null,
    "active_minutes": null,
    "ingredients": [
      {
        "id": "ri-tomate",
        "source_text": "400 g de tomates",
        "name_text": "tomates",
        "quantity": {
          "value": 400,
          "raw": "400"
        },
        "unit_id": "g"
      },
      {
        "id": "ri-oignon",
        "source_text": "100 g d’oignons",
        "name_text": "oignons",
        "quantity": {
          "value": 100,
          "raw": "100"
        },
        "unit_id": "g"
      }
    ],
    "steps": [
      {
        "id": "st-historique-panier-1",
        "position": 1,
        "text": "Commencer cette partie avec le bol, le panier et le Varoma vides. Vérifier les ingrédients et quantités indiqués avant tout ajout.\n1. Ajouter 400 g de tomates dans le panier.\n2. Ajouter 100 g d’oignons dans le bol.\n3. Réglages proposés : 10 s / sans chauffe / sens normal / vitesse 10. Couvercle en place ; accessoire : couteau.",
        "timers": [
          {
            "seconds": 10,
            "label": "Durée proposée : 10 s",
            "estimated": true
          }
        ]
      },
      {
        "id": "st-historique-panier-2",
        "text": "Faire cuire la sauce.",
        "position": 2
      },
      {
        "id": "st-historique-panier-3",
        "text": "Servir avec les pâtes.",
        "position": 3
      }
    ],
    "constraints": {
      "diets": [
        "vegetarien"
      ]
    },
    "provenance": {
      "source_page_ids": [],
      "convention_snapshot": {
        "id": "metric_ca",
        "revision": 1
      },
      "generated_by": "ai",
      "model": "fixture-historique",
      "incomplete": false,
      "thermomix": {
        "revision": 1,
        "profil": "tm7-na-120v-v1",
        "contexte": {
          "revision": 1,
          "profil": "tm7-na-120v-v1",
          "langue": "fr",
          "source": {
            "id": "rv-historique-panier-source",
            "recipe_id": "recette-historique-panier",
            "servings": 4,
            "ingredients": [
              {
                "id": "ri-tomate",
                "source_text": "400 g de tomates",
                "name_text": "tomates",
                "quantity": {
                  "value": 400,
                  "raw": "400"
                },
                "unit_id": "g"
              },
              {
                "id": "ri-oignon",
                "source_text": "100 g d’oignons",
                "name_text": "oignons",
                "quantity": {
                  "value": 100,
                  "raw": "100"
                },
                "unit_id": "g"
              }
            ],
            "steps": [
              {
                "id": "s1",
                "text": "Préparer les tomates et les oignons."
              },
              {
                "id": "s2",
                "text": "Faire cuire la sauce."
              },
              {
                "id": "s3",
                "text": "Servir avec les pâtes."
              }
            ],
            "constraints": {
              "diets": [
                "vegetarien"
              ]
            },
            "convention_snapshot": {
              "id": "metric_ca",
              "revision": 1
            },
            "prep_minutes": 10,
            "cook_minutes": 20,
            "active_minutes": 12,
            "total_minutes": 30,
            "incomplete": false,
            "plan_invalide": false
          },
          "source_signature": "{\"active_minutes\":12,\"constraints\":{\"diets\":[\"vegetarien\"]},\"convention_snapshot\":{\"id\":\"metric_ca\",\"revision\":1},\"cook_minutes\":20,\"id\":\"rv-historique-panier-source\",\"incomplete\":false,\"ingredients\":[{\"id\":\"ri-tomate\",\"name_text\":\"tomates\",\"quantity\":{\"raw\":\"400\",\"value\":400},\"source_text\":\"400 g de tomates\",\"unit_id\":\"g\"},{\"id\":\"ri-oignon\",\"name_text\":\"oignons\",\"quantity\":{\"raw\":\"100\",\"value\":100},\"source_text\":\"100 g d’oignons\",\"unit_id\":\"g\"}],\"plan_invalide\":false,\"prep_minutes\":10,\"recipe_id\":\"recette-historique-panier\",\"servings\":4,\"steps\":[{\"id\":\"s1\",\"text\":\"Préparer les tomates et les oignons.\"},{\"id\":\"s2\",\"text\":\"Faire cuire la sauce.\"},{\"id\":\"s3\",\"text\":\"Servir avec les pâtes.\"}],\"total_minutes\":30}",
          "selection": [
            "s1"
          ],
          "demande": "",
          "precisions": {
            "eau_vapeur_g": null,
            "volume_bol_l": null,
            "volume_panier_l": null,
            "froid_confirme": [
              "s1"
            ],
            "reponses": []
          },
          "anciens_blocs": [],
          "anciennes_precisions": {},
          "anciennes_langues": {}
        },
        "resultat": {
          "type": "proposition",
          "blocs": [
            {
              "source_step_id": "s1",
              "raison": "Réglages conservés dans le plan.",
              "actions": [
                {
                  "type": "preparation",
                  "operation": "ajouter",
                  "ingredients": [
                    "i1"
                  ],
                  "contenant": "panier"
                },
                {
                  "type": "preparation",
                  "operation": "ajouter",
                  "ingredients": [
                    "i2"
                  ],
                  "contenant": "bol"
                },
                {
                  "type": "reglage",
                  "mode": "manuel",
                  "secondes": 10,
                  "temperature": null,
                  "vitesse": 10,
                  "sens": "normal",
                  "accessoire": "couteau",
                  "ingredients": [
                    "i2"
                  ]
                }
              ]
            }
          ]
        },
        "blocs": [
          {
            "source_step_id": "s1",
            "raison": "Réglages conservés dans le plan.",
            "actions": [
              {
                "type": "preparation",
                "operation": "ajouter",
                "ingredients": [
                  "i1"
                ],
                "contenant": "panier"
              },
              {
                "type": "preparation",
                "operation": "ajouter",
                "ingredients": [
                  "i2"
                ],
                "contenant": "bol"
              },
              {
                "type": "reglage",
                "mode": "manuel",
                "secondes": 10,
                "temperature": null,
                "vitesse": 10,
                "sens": "normal",
                "accessoire": "couteau",
                "ingredients": [
                  "i2"
                ]
              }
            ]
          }
        ],
        "correspondance": [
          {
            "source_step_id": "s1",
            "step_id": "st-historique-panier-1"
          },
          {
            "source_step_id": "s2",
            "step_id": "st-historique-panier-2"
          },
          {
            "source_step_id": "s3",
            "step_id": "st-historique-panier-3"
          }
        ],
        "version_signature": "{\"generated_by\":\"ai\",\"invalidated\":false,\"kind\":\"adaptation\",\"parent_version_id\":\"rv-historique-panier-source\",\"source\":{\"active_minutes\":null,\"constraints\":{\"diets\":[\"vegetarien\"]},\"convention_snapshot\":{\"id\":\"metric_ca\",\"revision\":1},\"cook_minutes\":null,\"id\":\"rv-historique-panier\",\"incomplete\":false,\"ingredients\":[{\"id\":\"ri-tomate\",\"name_text\":\"tomates\",\"quantity\":{\"raw\":\"400\",\"value\":400},\"source_text\":\"400 g de tomates\",\"unit_id\":\"g\"},{\"id\":\"ri-oignon\",\"name_text\":\"oignons\",\"quantity\":{\"raw\":\"100\",\"value\":100},\"source_text\":\"100 g d’oignons\",\"unit_id\":\"g\"}],\"plan_invalide\":false,\"prep_minutes\":null,\"recipe_id\":\"recette-historique-panier\",\"servings\":4,\"steps\":[{\"id\":\"st-historique-panier-1\",\"position\":1,\"text\":\"Commencer cette partie avec le bol, le panier et le Varoma vides. Vérifier les ingrédients et quantités indiqués avant tout ajout.\\n1. Ajouter 400 g de tomates dans le panier.\\n2. Ajouter 100 g d’oignons dans le bol.\\n3. Réglages proposés : 10 s / sans chauffe / sens normal / vitesse 10. Couvercle en place ; accessoire : couteau.\",\"timers\":[{\"estimated\":true,\"label\":\"Durée proposée : 10 s\",\"seconds\":10}]},{\"id\":\"st-historique-panier-2\",\"position\":2,\"text\":\"Faire cuire la sauce.\"},{\"id\":\"st-historique-panier-3\",\"position\":3,\"text\":\"Servir avec les pâtes.\"}],\"total_minutes\":null}}",
        "reviewed_at": "2026-10-28T23:04:00.000Z",
        "modele": "fixture-historique"
      }
    },
    "parent_version_id": "rv-historique-panier-source",
    "changes": "Adaptation au TM7 des étapes sélectionnées.",
    "created_at": "2026-10-28T23:04:00.000Z",
    "updated_at": "2026-10-28T23:04:00.000Z"
  }
};
export const fixturePanierThermomixHistorique = () => structuredClone(FIXTURE);
