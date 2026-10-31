// Somme de liquides produite et relue par le code historique 0.23.1.
export const ORIGINE_CAPACITE_THERMOMIX_HISTORIQUE = Object.freeze({
  "commit": "752566d02a3bdddf6ec7a7afeae5d9280f3cc3d5",
  "sha256": "41df9d146077c1f64ff20feb9207477f900d7387e8aecbd9ced47ce49681545a"
});
const FIXTURE = {
  "original": {
    "id": "rv-historique-liquides-source",
    "recipe_id": "recette-historique-liquides",
    "kind": "extraction",
    "status": null,
    "servings": 4,
    "prep_minutes": 10,
    "cook_minutes": 20,
    "total_minutes": 30,
    "active_minutes": 12,
    "ingredients": [
      {
        "id": "ri-bouillon",
        "source_text": "1,5 L de bouillon",
        "name_text": "bouillon",
        "quantity": {
          "value": 1.5
        },
        "unit_id": "l"
      },
      {
        "id": "ri-lait",
        "source_text": "1 L de lait",
        "name_text": "lait",
        "quantity": {
          "value": 1
        },
        "unit_id": "l"
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
    "id": "rv-historique-liquides",
    "recipe_id": "recette-historique-liquides",
    "kind": "adaptation",
    "status": "proposed",
    "servings": 4,
    "prep_minutes": null,
    "cook_minutes": null,
    "total_minutes": null,
    "active_minutes": null,
    "ingredients": [
      {
        "id": "ri-bouillon",
        "source_text": "1,5 L de bouillon",
        "name_text": "bouillon",
        "quantity": {
          "value": 1.5
        },
        "unit_id": "l"
      },
      {
        "id": "ri-lait",
        "source_text": "1 L de lait",
        "name_text": "lait",
        "quantity": {
          "value": 1
        },
        "unit_id": "l"
      }
    ],
    "steps": [
      {
        "id": "st-liquides-1",
        "position": 1,
        "text": "Commencer cette partie avec le bol, le panier et le Varoma vides. Vérifier les ingrédients et quantités indiqués avant tout ajout.\n1. Ajouter 1,5 L de bouillon, 1 L de lait dans le bol.\n2. Réglages proposés : 8 min / 100 °C / sens normal / vitesse 1. Couvercle en place ; accessoire : couteau.",
        "timers": [
          {
            "seconds": 480,
            "label": "Durée proposée : 8 min",
            "estimated": true
          }
        ]
      },
      {
        "id": "st-liquides-2",
        "text": "Faire cuire la sauce.",
        "position": 2
      },
      {
        "id": "st-liquides-3",
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
            "id": "rv-historique-liquides-source",
            "recipe_id": "recette-historique-liquides",
            "servings": 4,
            "ingredients": [
              {
                "id": "ri-bouillon",
                "source_text": "1,5 L de bouillon",
                "name_text": "bouillon",
                "quantity": {
                  "value": 1.5
                },
                "unit_id": "l"
              },
              {
                "id": "ri-lait",
                "source_text": "1 L de lait",
                "name_text": "lait",
                "quantity": {
                  "value": 1
                },
                "unit_id": "l"
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
          "source_signature": "{\"active_minutes\":12,\"constraints\":{\"diets\":[\"vegetarien\"]},\"convention_snapshot\":{\"id\":\"metric_ca\",\"revision\":1},\"cook_minutes\":20,\"id\":\"rv-historique-liquides-source\",\"incomplete\":false,\"ingredients\":[{\"id\":\"ri-bouillon\",\"name_text\":\"bouillon\",\"quantity\":{\"value\":1.5},\"source_text\":\"1,5 L de bouillon\",\"unit_id\":\"l\"},{\"id\":\"ri-lait\",\"name_text\":\"lait\",\"quantity\":{\"value\":1},\"source_text\":\"1 L de lait\",\"unit_id\":\"l\"}],\"plan_invalide\":false,\"prep_minutes\":10,\"recipe_id\":\"recette-historique-liquides\",\"servings\":4,\"steps\":[{\"id\":\"s1\",\"text\":\"Préparer les tomates et les oignons.\"},{\"id\":\"s2\",\"text\":\"Faire cuire la sauce.\"},{\"id\":\"s3\",\"text\":\"Servir avec les pâtes.\"}],\"total_minutes\":30}",
          "selection": [
            "s1"
          ],
          "demande": "",
          "precisions": {
            "eau_vapeur_g": null,
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
                  "mode": "manuel",
                  "secondes": 480,
                  "temperature": 100,
                  "vitesse": 1,
                  "sens": "normal",
                  "accessoire": "couteau",
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
                "mode": "manuel",
                "secondes": 480,
                "temperature": 100,
                "vitesse": 1,
                "sens": "normal",
                "accessoire": "couteau",
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
            "step_id": "st-liquides-1"
          },
          {
            "source_step_id": "s2",
            "step_id": "st-liquides-2"
          },
          {
            "source_step_id": "s3",
            "step_id": "st-liquides-3"
          }
        ],
        "version_signature": "{\"generated_by\":\"ai\",\"invalidated\":false,\"kind\":\"adaptation\",\"parent_version_id\":\"rv-historique-liquides-source\",\"source\":{\"active_minutes\":null,\"constraints\":{\"diets\":[\"vegetarien\"]},\"convention_snapshot\":{\"id\":\"metric_ca\",\"revision\":1},\"cook_minutes\":null,\"id\":\"rv-historique-liquides\",\"incomplete\":false,\"ingredients\":[{\"id\":\"ri-bouillon\",\"name_text\":\"bouillon\",\"quantity\":{\"value\":1.5},\"source_text\":\"1,5 L de bouillon\",\"unit_id\":\"l\"},{\"id\":\"ri-lait\",\"name_text\":\"lait\",\"quantity\":{\"value\":1},\"source_text\":\"1 L de lait\",\"unit_id\":\"l\"}],\"plan_invalide\":false,\"prep_minutes\":null,\"recipe_id\":\"recette-historique-liquides\",\"servings\":4,\"steps\":[{\"id\":\"st-liquides-1\",\"position\":1,\"text\":\"Commencer cette partie avec le bol, le panier et le Varoma vides. Vérifier les ingrédients et quantités indiqués avant tout ajout.\\n1. Ajouter 1,5 L de bouillon, 1 L de lait dans le bol.\\n2. Réglages proposés : 8 min / 100 °C / sens normal / vitesse 1. Couvercle en place ; accessoire : couteau.\",\"timers\":[{\"estimated\":true,\"label\":\"Durée proposée : 8 min\",\"seconds\":480}]},{\"id\":\"st-liquides-2\",\"position\":2,\"text\":\"Faire cuire la sauce.\"},{\"id\":\"st-liquides-3\",\"position\":3,\"text\":\"Servir avec les pâtes.\"}],\"total_minutes\":null}}",
        "reviewed_at": "2026-10-28T23:03:00.000Z",
        "modele": "fixture-historique"
      }
    },
    "parent_version_id": "rv-historique-liquides-source",
    "changes": "Adaptation au TM7 des étapes sélectionnées.",
    "created_at": "2026-10-28T23:03:00.000Z",
    "updated_at": "2026-10-28T23:03:00.000Z"
  }
};
export const fixtureCapaciteThermomixHistorique = () => structuredClone(FIXTURE);
