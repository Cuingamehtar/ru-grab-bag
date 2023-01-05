Hooks.once('init', async function () {

    function getTranslationModules() {
        const knownTranslationModules = ["ru-ru", "pf2e-ru", "PF2E-RUB"];

        return knownTranslationModules.map(n => game.modules.get(n)).filter(m => m);
    }

    function getSupportedActiveModules(translationModule) {
        return {
            "translationModuleId": translationModule.id, "translatedModules": translationModule.languages
                .filter(l => l.module && game.modules.get(l.module)?.active)
                .map(l => l.module)
        };
    }

    function getModulesWithConflictTranslations(translationModules) {
        let translations = translationModules.map(t => getSupportedActiveModules(t));
        let uniqueTranslatedModules = translations.map(t => t.translatedModules).reduce((a, c) => new Set([...a, ...c]));
        let conflictModules = uniqueTranslatedModules.map(m => ({ "id": m, "translatedBy": translations.filter(t => t.translatedModules.has(m)).map(t => t.translationModuleId) })).filter(m => m.translatedBy.length > 1);
        return conflictModules;
    }

    let translationModules = getTranslationModules();
    let conflictTranslations = getModulesWithConflictTranslations(translationModules);

    conflictTranslations.forEach(m => {
        let choices = {};
        m.translatedBy.forEach(t => choices[t] = game.modules.get(t).title);
        game.settings.register("ru-grab-bag", "moduleTranslationSelect_" + m.id, {
            name: "Перевод модуля " + game.modules.get(m.id).title,
            type: String,
            choices: choices,
            default: choices["ru-ru"] ? "ru-ru" : m.translatedBy[0],
            scope: "world",
            config: true,
            restricted: true,
            onChange: (value) => {
                window.location.reload();
            },
        });
    })

    if (typeof libWrapper === "function") {
        libWrapper.register("ru-grab-bag",
            "game.i18n._getTranslations",
            loadSelectedTranslations,
            "MIXED");
    }
    else {
        new Dialog({
            title: "Выбор перевода",
            content: `<p>Для выбора модулей переводов необходимо активировать модуль <b>libWrapper</b></p>`,
            buttons: {
                done: {
                    label: "Хорошо",
                },
            },
        }).render(true);
    }

    async function loadSelectedTranslations(wrapped, lang) {
        const defaultTranslations = await wrapped(lang);
        const promises = [];

        conflictTranslations.forEach(m => {
            let settingsName = "moduleTranslationSelect_" + m.id;
            let settingsValue = game.settings.get("ru-grab-bag", settingsName);
            if (settingsValue) {
                let path = game.modules.get(settingsValue).languages.filter(l => l.module == m.id).first().path;
                promises.push(
                    this._loadTranslationFile(path)
                );

            }
        })


        await Promise.all(promises);
        for (let p of promises) {
            let json = await p;
            foundry.utils.mergeObject(defaultTranslations, json, { inplace: true });
        }

        return defaultTranslations;
    }

});

