// Données figées produites par le code historique 0.23.1, puis relues ok:true par ce même code.
// Aucun appel au constructeur courant : ce témoin doit survivre aux changements de validation.
export const ORIGINE_THERMOMIX_HISTORIQUE = Object.freeze({
  "commit": "752566d02a3bdddf6ec7a7afeae5d9280f3cc3d5",
  "version": "0.23.1",
  "blob_thermomix": "4ea95a08e6c9f1c487af3499b1c6bf89f6316d00",
  "sha256": "ef3d42307de72b31504f23f923458df62f788cb3048c3aaf1749d3dc3ffd1a97"
});
const FIXTURE = {
  "recipe": {
    "id": "recette-historique-tm7",
    "original_title": "Sauce historique",
    "availability": "available",
    "current_version_id": "rv-historique-tm7",
    "source_page_ids": [],
    "verification_state": "verified",
    "created_at": "2026-10-28T23:00:00.000Z",
    "updated_at": "2026-10-28T23:00:00.000Z"
  },
  "original": {
    "id": "rv-historique-source",
    "recipe_id": "recette-historique-tm7",
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
    },
    "created_at": "2026-10-28T23:00:00.000Z",
    "updated_at": "2026-10-28T23:00:00.000Z"
  },
  "version": {
    "id": "rv-historique-tm7",
    "recipe_id": "recette-historique-tm7",
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
        "id": "st-historique-1",
        "position": 1,
        "text": "Commencer cette partie avec le bol, le panier et le Varoma vides. Vérifier les ingrédients et quantités indiqués avant tout ajout.\n1. Ajouter 400 g de tomates, 100 g d’oignons dans le bol.\n2. Réglages proposés : 8 min / mode Vapeur / sens normal / vitesse 1. Installer panier et Varoma selon le manuel ; passages de vapeur libres. Eau du bol renseignée : 3000 g.",
        "timers": [
          {
            "seconds": 480,
            "label": "Durée proposée : 8 min",
            "estimated": true
          }
        ]
      },
      {
        "id": "st-historique-2",
        "text": "Faire cuire la sauce.",
        "position": 2
      },
      {
        "id": "st-historique-3",
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
            "id": "rv-historique-source",
            "recipe_id": "recette-historique-tm7",
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
          "source_signature": "{\"active_minutes\":12,\"constraints\":{\"diets\":[\"vegetarien\"]},\"convention_snapshot\":{\"id\":\"metric_ca\",\"revision\":1},\"cook_minutes\":20,\"id\":\"rv-historique-source\",\"incomplete\":false,\"ingredients\":[{\"id\":\"ri-tomate\",\"name_text\":\"tomates\",\"quantity\":{\"raw\":\"400\",\"value\":400},\"source_text\":\"400 g de tomates\",\"unit_id\":\"g\"},{\"id\":\"ri-oignon\",\"name_text\":\"oignons\",\"quantity\":{\"raw\":\"100\",\"value\":100},\"source_text\":\"100 g d’oignons\",\"unit_id\":\"g\"}],\"plan_invalide\":false,\"prep_minutes\":10,\"recipe_id\":\"recette-historique-tm7\",\"servings\":4,\"steps\":[{\"id\":\"s1\",\"text\":\"Préparer les tomates et les oignons.\"},{\"id\":\"s2\",\"text\":\"Faire cuire la sauce.\"},{\"id\":\"s3\",\"text\":\"Servir avec les pâtes.\"}],\"total_minutes\":30}",
          "selection": [
            "s1"
          ],
          "demande": "",
          "precisions": {
            "eau_vapeur_g": 3000,
            "volume_bol_l": null,
            "volume_panier_l": null,
            "froid_confirme": [],
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
              "raison": "Remuer la sauce dans le bol.",
              "actions": [
                {
                  "type": "preparation",
                  "operation": "ajouter",
                  "ingredients": [
                    "i1",
                    "i2"
                  ],
                  "contenant": "bol"
                },
                {
                  "type": "reglage",
                  "mode": "vapeur",
                  "secondes": 480,
                  "temperature": null,
                  "vitesse": 1,
                  "sens": "normal",
                  "accessoire": "panier_varoma",
                  "ingredients": [
                    "i1",
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
            "raison": "Remuer la sauce dans le bol.",
            "actions": [
              {
                "type": "preparation",
                "operation": "ajouter",
                "ingredients": [
                  "i1",
                  "i2"
                ],
                "contenant": "bol"
              },
              {
                "type": "reglage",
                "mode": "vapeur",
                "secondes": 480,
                "temperature": null,
                "vitesse": 1,
                "sens": "normal",
                "accessoire": "panier_varoma",
                "ingredients": [
                  "i1",
                  "i2"
                ]
              }
            ]
          }
        ],
        "correspondance": [
          {
            "source_step_id": "s1",
            "step_id": "st-historique-1"
          },
          {
            "source_step_id": "s2",
            "step_id": "st-historique-2"
          },
          {
            "source_step_id": "s3",
            "step_id": "st-historique-3"
          }
        ],
        "version_signature": "{\"generated_by\":\"ai\",\"invalidated\":false,\"kind\":\"adaptation\",\"parent_version_id\":\"rv-historique-source\",\"source\":{\"active_minutes\":null,\"constraints\":{\"diets\":[\"vegetarien\"]},\"convention_snapshot\":{\"id\":\"metric_ca\",\"revision\":1},\"cook_minutes\":null,\"id\":\"rv-historique-tm7\",\"incomplete\":false,\"ingredients\":[{\"id\":\"ri-tomate\",\"name_text\":\"tomates\",\"quantity\":{\"raw\":\"400\",\"value\":400},\"source_text\":\"400 g de tomates\",\"unit_id\":\"g\"},{\"id\":\"ri-oignon\",\"name_text\":\"oignons\",\"quantity\":{\"raw\":\"100\",\"value\":100},\"source_text\":\"100 g d’oignons\",\"unit_id\":\"g\"}],\"plan_invalide\":false,\"prep_minutes\":null,\"recipe_id\":\"recette-historique-tm7\",\"servings\":4,\"steps\":[{\"id\":\"st-historique-1\",\"position\":1,\"text\":\"Commencer cette partie avec le bol, le panier et le Varoma vides. Vérifier les ingrédients et quantités indiqués avant tout ajout.\\n1. Ajouter 400 g de tomates, 100 g d’oignons dans le bol.\\n2. Réglages proposés : 8 min / mode Vapeur / sens normal / vitesse 1. Installer panier et Varoma selon le manuel ; passages de vapeur libres. Eau du bol renseignée : 3000 g.\",\"timers\":[{\"estimated\":true,\"label\":\"Durée proposée : 8 min\",\"seconds\":480}]},{\"id\":\"st-historique-2\",\"position\":2,\"text\":\"Faire cuire la sauce.\"},{\"id\":\"st-historique-3\",\"position\":3,\"text\":\"Servir avec les pâtes.\"}],\"total_minutes\":null}}",
        "reviewed_at": "2026-10-28T23:00:00.000Z",
        "modele": "fixture-historique"
      }
    },
    "created_at": "2026-10-28T23:00:00.000Z",
    "updated_at": "2026-10-28T23:00:00.000Z",
    "parent_version_id": "rv-historique-source",
    "changes": "Adaptation au TM7 des étapes sélectionnées."
  }
};
export const fixtureThermomixHistorique = () => structuredClone(FIXTURE);
