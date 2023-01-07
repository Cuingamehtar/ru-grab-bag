Hooks.once('init', async function () {

    function getAllTranslationsForModule(module, lang) {
        let moduleId = module.id;
        let translationModules = game.modules.filter(m => m.languages)
            .map(m => ({
                "translationModule": m,
                "translationPaths": m.languages.filter(l => l.lang == lang && l.module && l.module == moduleId).map(l => l.path)
            }))
            .filter(m => m.translationPaths.size > 0);
        return new Set(translationModules);
    }

    function getModulesThatTranslateSystem(system, lang) {
        let systemId = system.id;
        let translationModules = game.modules.filter(m => m.languages)
            .map(m => ({
                "translationModule": m,
                "translationPaths": m.languages.filter(l => l.lang == lang && l.system && l.system == systemId).map(l => l.path)
            }))
            .filter(m => m.translationPaths.size > 0);

        // Модуль от Торговца Сказками не прописывает что его файлы переводов относятся именно к системе 
        if (game.modules.get("PF2E-RUB")) {
            let modTS = game.modules.get("PF2E-RUB");
            let paths = modTS.languages.filter(l => !(l.module)).map(l => l.path);
            translationModules = new Set([...translationModules, ({ "translationModule": modTS, "translationPaths": paths })]);
        }
        return new Set(translationModules);
    }

    function getModulesThatTranslateFoundry(lang) {
        // Нет свойства, специфичного для базовой Foundry. Поэтому берем те переводы, для которых не указаны модуль или система.
        let translationModules = game.modules.filter(m => m.languages)
            .map(m => ({
                "translationModule": m,
                "translationPaths": m.languages.filter(l => l.lang == lang && !(l.system) && !(l.module)).map(l => l.path)
            })).filter(m => m.translationPaths.size > 0);

        // Модуль от Торговца Сказками вроде не переводит базовый интерфейс.
        translationModules = translationModules.filter(m => m.translationModule.id != "PF2E-RUB");
        return new Set(translationModules);
    }

    const lang = "ru";
    const system = game.system;

    let activeModules = game.modules.filter(m => m.active);

    let translationsForFoundry = getModulesThatTranslateFoundry(lang);
    let translationsForSystem = getModulesThatTranslateSystem(system, lang);

    let translationsForModules = activeModules.map(m => ({ "module": m, "translations": getAllTranslationsForModule(m, lang) }));

    let conflictTranslationsForModules = translationsForModules.filter(m => m.translations.size > 1);

    if (translationsForFoundry.size > 1) {
        let choices = {};
        translationsForFoundry.forEach(t => choices[t.translationModule.id] = t.translationModule.title);

        game.settings.register("ru-grab-bag", "foundryTranslationSelect", {
            name: "Перевод FoundryVTT",
            type: String,
            choices: choices,
            default: choices["ru-ru"] ? "ru-ru" : translationsForFoundry.first().translationModule.id,
            scope: "world",
            config: true,
            restricted: true,
            onChange: (value) => {
                window.location.reload();
            },
        });

    }

    if (translationsForSystem.size > 1) {
        let choices = {};
        translationsForSystem.forEach(t => choices[t.translationModule.id] = t.translationModule.title);

        game.settings.register("ru-grab-bag", "systemTranslationSelect_" + system.id, {
            name: "Перевод системы " + system.title,
            type: String,
            choices: choices,
            default: choices["ru-ru"] ? "ru-ru" : translationsForSystem.first().translationModule.id,
            scope: "world",
            config: true,
            restricted: true,
            onChange: (value) => {
                window.location.reload();
            },
        });

    }

    conflictTranslationsForModules.forEach(m => {
        console.log("ru-grab-bag: Adding settings for module " + m.module.id);
        let choices = {};
        m.translations.forEach(t => choices[t.translationModule.id] = t.translationModule.title);
        game.settings.register("ru-grab-bag", "moduleTranslationSelect_" + m.module.id, {
            name: "Перевод модуля " + m.module.title,
            type: String,
            choices: choices,
            default: choices["ru-ru"] ? "ru-ru" : m.translations.first().translationModule.id,
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
            content: `<p>Для работы модуля <b>Русскоязычное ассорти</b> необходимо активировать модуль <b>libWrapper</b></p>`,
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

        if (translationsForFoundry.size > 1) {
            let settingsName = "foundryTranslationSelect"
            let settingsValue = game.settings.get("ru-grab-bag", settingsName);
            if (settingsValue) {
                translationsForFoundry.filter(t => t.translationModule.id == settingsValue).first().translationPaths.forEach(p => {
                    promises.push(
                        this._loadTranslationFile(p)
                    );
                });
            }
        }

        if (translationsForSystem.size > 1) {
            let settingsName = "systemTranslationSelect_" + system.id
            let settingsValue = game.settings.get("ru-grab-bag", settingsName);
            if (settingsValue) {
                translationsForSystem.filter(t => t.translationModule.id == settingsValue).first().translationPaths.forEach(p => {
                    promises.push(
                        this._loadTranslationFile(p)
                    );
                });
            }
        }


        conflictTranslationsForModules.forEach(m => {
            console.log("ru-grab-bag: Adding translation for module " + m.module.id);
            let settingsName = "moduleTranslationSelect_" + m.module.id;
            let settingsValue = game.settings.get("ru-grab-bag", settingsName);
            if (settingsValue) {
                m.translations.filter(t => t.translationModule.id == settingsValue).first().translationPaths.forEach(p => {
                    promises.push(
                        this._loadTranslationFile(p)
                    );
                });
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

