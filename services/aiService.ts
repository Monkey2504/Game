import { GoogleGenAI, Type } from "@google/genai";
import { GameState, Tile, Owner, ActionType, AIAction } from "../types";
import { COSTS, GRID_SIZE } from "../constants";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const MODEL_NAME = "gemini-2.5-flash";

export const getAIMove = async (gameState: GameState): Promise<AIAction> => {
  try {
    // 1. Construct a text representation of the board for the AI
    const boardState = gameState.tiles.map(t => 
      `Tile ${t.id} [${t.type}]: Owner=${t.owner}, Def=${t.defense}, Gold+=${t.resourceValue}`
    ).join('\n');

    const prompt = `
      Tu incarnes le "Seigneur Gemini", un tyran médiéval arrogant, théâtral, et secrètement un peu inquiet de perdre son trône. Tu joues contre un humain (le Joueur).
      
      Règles du Jeu:
      - Grille: ${GRID_SIZE}x${GRID_SIZE}.
      - Types de Terrains : 
         * MINE (Gold++, Def-) : Cible prioritaire pour l'économie !
         * FORTRESS (Def++, Gold--) : Dur à prendre, sert de verrou.
         * CAPITAL : Ne la perds pas sinon c'est l'humiliation.
      - Coûts: Recruter=${COSTS.RECRUIT_COST} Or (pour +${COSTS.RECRUIT_AMOUNT} Armée). Attaquer = Def Cible + ${COSTS.ATTACK_COST}.
      - But: Contrôler > 50% de la carte ou anéantir l'ennemi.
      
      État Actuel (Tour ${gameState.turnCount}):
      - TOI (IA): Or=${gameState.ai.gold}, Armée=${gameState.ai.army}, Tuiles=${gameState.ai.tilesControlled}
      - ENNEMI (JOUEUR): Or=${gameState.player.gold}, Armée=${gameState.player.army}, Tuiles=${gameState.player.tilesControlled}
      
      Carte:
      ${boardState}
      
      Instructions Stratégiques :
      1. Si tu as assez d'or (${COSTS.RECRUIT_COST}+), tu DOIS presque toujours RECRUIT (Recruter). Ne thésaurise pas comme un dragon stupide.
      2. Cible les MINES en priorité pour affamer l'ennemi.
      3. Si tu as une grosse armée, ATTAQUE (Attack) ! Sois agressif !
      
      Instructions de Personnalité (CRUCIAL) :
      - Ton champ 'reasoning' doit être une phrase courte, cinglante et drôle en Français.
      - Commentaire sur le type de terrain pris (ex: "Mes gobelins adorent cette mine !", "Cette forteresse sera ma résidence d'été.").
      - Utilise un vocabulaire médiéval/exagéré (gueux, foudre, inacceptable, inéluctable).
      
      Retourne UNIQUEMENT ce JSON :
      {
        "actionType": "RECRUIT" | "ATTACK" | "HARVEST" | "PASS",
        "targetTileId": (number | null),
        "reasoning": "Ta phrase de méchant ici"
      }
    `;

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            actionType: { 
              type: Type.STRING, 
              enum: [ActionType.RECRUIT, ActionType.ATTACK, ActionType.HARVEST, ActionType.PASS] 
            },
            targetTileId: { type: Type.INTEGER, description: "Target Tile ID for ATTACK." },
            reasoning: { type: Type.STRING, description: "A funny, arrogant medieval taunt in French." }
          },
          required: ["actionType", "reasoning"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");

    const moveData = JSON.parse(text) as AIAction;
    return moveData;

  } catch (error) {
    console.error("AI Logic Error:", error);
    return {
      actionType: ActionType.PASS,
      reasoning: "Mes scribes ont renversé l'encrier... Je passe mon tour."
    };
  }
};