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
- `game.json` — abilities, skills, categories, rarity, equipment slots, damage types, weapon properties, weapons (30+ base weapons), armorProficiencies, weaponProficiencies, classResources, passiveStats, damageTypesFull, diceErrors, diceNotation, storageErrors, healingType
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

### Utility files fully refactored
- `src/utils/dnd.ts` — getSkillName(), getAbilityName(), getAbilityShort() use i18n.t() directly
- `src/data/items/constants.ts` — getCategoryName(), getRarityName(), getDamageTypeName(), getPropertyName(), getMasteryName() use i18n.t()
- `src/utils/weaponAttacks.ts` — WEAPON_STATS uses damage type codes (B/S/P) and property codes (F/L/T), translated via getDamageTypeName()/getPropertyName(). Russian weapon name duplicates removed; RU_TO_EN_WEAPON mapping kept for backward compatibility. Unarmed strike name via i18n.t()
- `src/utils/classEffects.ts` — WEAPON_NAME_TO_RU replaced with getWeaponProficiencyName() via i18n.t(). hasItemProficiency() armor/weapon strings via i18n.t()
- `src/utils/classResources.ts` — TRACKABLE_RESOURCES and PASSIVE_STAT_LABELS use labelKey + i18n.t() at runtime (lazy evaluation). Subclass resources also use i18n.t()
- `src/utils/spellCasting.ts` — translateSaveAbility() uses i18n.t('abilities.*'). translateDamageType() uses i18n.t('damageTypesFull.*'). Healing type via i18n.t('healingType')
- `src/utils/diceRoller.ts` — error messages and dice notation via i18n.t('diceErrors.*', 'diceNotation.*')
- `src/utils/storage.ts` — user-facing import error messages via i18n.t('storageErrors.*')

### Utility files checked — clean (no user-facing Russian)
- `src/utils/autoSpells.ts` — no Cyrillic at all
- `src/utils/featEffects.ts` — no Cyrillic at all

### Key patterns used
- Components: `const { t } = useTranslation('namespace')` + `t('key')` / `t('key', { var })`
- Utility files: `import i18n from '../i18n'` + `i18n.t('key', { ns: 'namespace' })`
- Dictionaries outside components → moved inside component body or converted to functions accepting `t`
- Alignment system: stores i18n keys ('lawfulGood') instead of Russian strings
- Weapon stats: store damage type codes ('B','S','P') and property codes ('F','L','T'), translate at output time

## What still needs to be done

### Data files with Russian strings
- `src/data/classes/` (~17 files) — class names, descriptions, subclass names, proficiency strings (armor, weapons, tools)
- `src/data/races/` (~9 files) — race names, trait names/descriptions, languages, sizes, subrace info
- `src/data/backgrounds/` (~17 files) — background names, feat names, skill proficiencies, tool proficiency, descriptions, equipment
- `src/data/registry.ts` — PHASES labels ('Заклинания', 'Черты', etc.), report() calls
- `src/data/feats/index.ts` — FEAT_CATEGORY_NAMES ('Общая черта', 'Черта происхождения', etc.)
- `src/data/skills/index.ts` — ABILITY_ABBR_NAMES ('Сила', 'Ловкость', etc.)

### Approach for data files
Two possible strategies:
1. **Key-based**: data files store i18n keys, translation happens via game.json — requires massive game.json expansion (hundreds of class/race/background descriptions)
2. **Inline bilingual**: data files keep both `name` (English) and translation via i18n lookup by id — simpler but may need a new namespace

### Crowdin setup (Etap 7 per CROWDIN_GUIDE.md)
- Create Crowdin project
- Configure crowdin.yml
- Upload source files (en/*.json)
- Set up GitHub integration for auto-sync

### Migration concern
- Existing characters may have alignment stored as Russian strings (e.g., 'Законно-добрый'). A migration utility may be needed to convert them to i18n keys ('lawfulGood'). This affects CharacterList.tsx easter egg check and RoleplayTab alignment display.
- Existing characters may have proficiencies stored as Russian strings. The current code handles this via RU_TO_EN_WEAPON mapping and i18n-based proficiency lookups, but stored proficiency arrays in character data may need migration.

### Testing
- Full end-to-end testing with both en and ru locales
- Verify all components render correctly
- Check for any missed hardcoded strings in edge cases

## Technical notes
- TypeScript check (`npx tsc --noEmit`) passes clean
- Source language: English (en), Target: Russian (ru)
- All remaining Cyrillic in utility/component files is in code comments only (not user-facing)
- The `T1-Logo.svg` file was deleted (unrelated to i18n)
- Build errors in InventoryGrid.tsx, SpellsTab.tsx, SpellCastModal.tsx etc. are pre-existing and unrelated to i18n
