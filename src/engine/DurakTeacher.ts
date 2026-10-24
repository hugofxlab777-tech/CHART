import { DurakEngine } from './DurakEngine';
import { SUIT_SYMBOLS, SUIT_NAMES_LT } from './types';

export class DurakTeacher {
  public static getRuleSummaryLt(engine: DurakEngine): string {
    const variantLt = engine.options.variant === 'podkidnoy_durak' ? 'Metamas durnius' : 'Perduodamasis durnius';
    const trumpSym = SUIT_SYMBOLS[engine.trumpSuit];
    const trumpName = SUIT_NAMES_LT[engine.trumpSuit];

    return `
🃏 **Žaidimo režimas**: ${variantLt}
👑 **Koziris**: ${trumpSym} (${trumpName})
📦 **Kaladė**: liko ${engine.deck.length} kortų (iš viso ${engine.options.deckSize})
👥 **Raundo limitas**: iki ${engine.roundNumber === 1 && engine.options.firstRoundAttackLimit === 5 ? 5 : 6} kortų (arba tiek, kiek gynėjas turi rankoje).

🎯 **Kaip mušti kortą:**
1. Aukštesne tos pačios spalvos korta (pvz. 9♠ kerta 8♠).
2. Bet kokiu koziriu (${trumpSym}), jei puolama ne koziriu.
3. Aukštesniu koziriu, jei puolama koziriu.

🔄 **Perduodamojo durniaus taisyklė:**
Gynėjas gali pridėti tokio paties rango kortą ir nukreipti visą ataką sekančiam žaidėjui, tačiau tik kol pats neišmušė jokios kortos ir jei sekantis žaidėjas turi pakankamai kortų!
    `.trim();
  }

  public static getFewShotExplanation(exampleId: number): string {
    switch (exampleId) {
      case 1:
        return 'Pavyzdys 1 (Metamas durnius): Koziris ♥. Puolėjas deda 8♠. Gynėjas turi 9♠, K♦, 6♥. Galimi ėjimai: kirsti su 9♠ (aukštesnė tos pačios spalvos), kirsti su 6♥ (net ir mažiausias koziris kerta bet kurį ne kozirį) arba imti kortas.';
      case 2:
        return 'Pavyzdys 2 (Metamas durnius): Ant stalo guli 8♠, sumušta su 9♠. Kitas žaidėjas turi 9♦ ir 7♣. Galima primesti tik 9♦, nes 9 jau yra ant stalo; 7♣ primesti neleistina, nes 7 ant stalo nėra.';
      case 3:
        return 'Pavyzdys 3 (Perduodamasis durnius): Puolėjas deda 10♣. Gynėjas turi 10♦ ir A♣. Sekantis žaidėjas turi 4 kortas. Gynėjas gali padėti 10♦ ir perduoti ataką (10♣ + 10♦) sekančiam žaidėjui.';
      case 4:
        return 'Pavyzdys 4 (Perduodamasis durnius): Puolėjas deda 7♥. Gynėjas sumuša ją su 9♥, o po to nori perduoti su 7. Tai NELEISTINA – kai bent viena korta jau sumušta, perduoti atakos nebegalima.';
      default:
        return '';
    }
  }
}
