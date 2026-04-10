# i18n Refactoring Context — for next chat session

## Branch: `feature/i18n-setup`

## What was done

### Infrastructure (commit c443d91)
- Installed `i18next`, `react-i18next`, `i18next-browser-languagedetector`
- Created `src/i18n/index.ts` — config hub with LanguageDetector, fallbackLng: 'en', defaultNS: 'common'
- 7 namespaces: common, character, spells, combat, inventory, glossary, game
- Created `CROWDIN_GUIDE.md` at project root

### Locale files (src/i18n/locales/)
- **en/** and **ru/** directories with 7 JSON files each
- `game.json` — abilities, skills, categories, rarity, equipment slots, damage types, weapon properties, etc.
- `common.json` — nav tabs, glossary tabs, buttons, loading, errors, alerts, homePage, characterList, sidebar
- `character.json` — creation (steps, sizes, schools, spells, race, class, abilities, background, details, alignments, classMap, review), sheet (tabs, header, health, skills, features, conditions with 40+ names, resistances with modifiers, deathSaves, proficiencies, hpRoll, subclass, fightingStyleReplace, fsCantripPicker), roleplay, featPicker, invocationPicker, expertisePicker, portraitCrop
- `spells.json` — common, meta, spellSlots, resources, attacks, actions, spellcasting, preparation, levelUp, cast, swap, featSpells, autoSpells, tooltip, contextMenu, abilityLabels, schoolLabels, spellLevelLabels
- `combat.json` — diceTab, diceRoll
- `inventory.json` — full inventory UI strings
- `glossary.json` — sort, filter, rarityNames, categories, subclassList, spell formatting, feat prerequisites, abilities, detail view, species, background, item, classDetail, subclassDetail, charOptionDetail, ui, classFeature

### Components fully refactored (ALL user-facing Russian → t() calls)
- `src/App.tsx`
- `src/components/CharacterCreator.tsx`
- `src/components/CharacterSheet.tsx`
- `src/components/CharacterList.tsx`
- `src/components/Glossary.tsx`
- `src/components/RoleplayTab.tsx`
- `src/components/SpellsTab.tsx`
- `src/components/SpellLevelUpModal.tsx`
- `src/components/SpellCastModal.tsx`
- `src/components/SpellPreparationModal.tsx`
- `src/components/FeatPickerModal.tsx`
- `src/components/FeatSpellPickerModal.tsx`
- `src/components/FeatSpellSwapModal.tsx`
- `src/components/AutoSpellsNotificationModal.tsx`
- `src/components/InvocationPickerModal.tsx`
- `src/components/ExpertisePickerModal.tsx`
- `src/components/PortraitCropModal.tsx`
- `src/components/DiceTab.tsx`
- `src/components/DiceRollProvider.tsx`
- `src/components/HomePage.tsx`
- `src/components/InventoryGrid.tsx`
- `src/components/ui/CharacterStatsSidebar.tsx`
- `src/components/ui/SpellTooltip.tsx`
- `src/components/SpellContextMenu.tsx`

### Utility files refactored
- `src/utils/dnd.ts` — getSkillName(), getAbilityName(), getAbilityShort() use i18n.t() directly
- `src/data/items/constants.ts` — getCategoryName(), getRarityName(), getDamageTypeName(), getPropertyName(), getMasteryName() use i18n.t()

### Key patterns used
- Components: `const { t } = useTranslation('namespace')` + `t('key')` / `t('key', { var })`
- Utility files: `import i18n from '../i18n'` + `i18n.t('key', { ns: 'namespace' })`
- Dictionaries outside components → moved inside component body or converted to functions accepting `t`
- Alignment system: stores i18n keys ('lawfulGood') instead of Russian strings

## What still needs to be done

### Utility files with Russian strings
Check these for remaining user-facing Russian (may be comments only):
- `src/utils/weaponAttacks.ts` (~100 occurrences — likely mostly comments)
- `src/utils/classEffects.ts` (~47)
- `src/utils/classResources.ts` (~18)
- `src/utils/spellCasting.ts` (~21)
- `src/utils/diceRoller.ts` (~5)
- `src/utils/storage.ts` (~7)
- `src/utils/autoSpells.ts`
- `src/utils/featEffects.ts`

### Data files with Russian strings
- `src/data/classes/` (~15 files)
- `src/data/races/` (~9 files)
- `src/data/backgrounds/` (~16 files)
- `src/data/registry.ts`
- `src/data/feats/index.ts`
- `src/data/skills/index.ts`
- Other data files

### Crowdin setup (Etap 7 per CROWDIN_GUIDE.md)
- Create Crowdin project
- Configure crowdin.yml
- Upload source files (en/*.json)
- Set up GitHub integration for auto-sync

### Migration concern
- Existing characters may have alignment stored as Russian strings (e.g., 'Законно-добрый'). A migration utility may be needed to convert them to i18n keys ('lawfulGood'). This affects CharacterList.tsx easter egg check and RoleplayTab alignment display.

### Testing
- Full end-to-end testing with both en and ru locales
- Verify all components render correctly
- Check for any missed hardcoded strings in edge cases

## Technical notes
- TypeScript check (`npx tsc --noEmit`) passes clean
- Source language: English (en), Target: Russian (ru)
- All remaining Cyrillic in component files is in code comments only (not user-facing)
- The `T1-Logo.svg` file was deleted (unrelated to i18n)
