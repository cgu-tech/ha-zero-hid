import { Globals } from './globals.js';
import { Logger } from './logger.js';
import * as translations from '../translations/index.js';

export class Localization {

  // private init required constants
  static _DEFAULT_LANG = "en";  

  _origin;
  _translationsByLanguages;

  // Usage:
  // const localization = new Localization(this, import.meta.url);
  constructor(origin) {
    this._origin = origin;
    this._translationsByLanguages = this.constructor.getTranslationsByLanguages(translations);
  }

  getLogger() {
    return this._origin?.getLogger();
  }

  getHass() {
    // Aggressively tries to retrieve HASS because we depend on it for dynamic lang retrieval
    return this._origin?.getHass() || document.querySelector("home-assistant")?.hass;
  }

  getDefaultLang() {
    return this.constructor._DEFAULT_LANG;
  }

  getLang() {
    return this.getHass()?.language || this.getDefaultLang();
  }

  localize(key) {
    return this.tryGetLocalized(this._translationsByLanguages.get(this.getLang())?.values, key)
        || this.tryGetLocalized(this._translationsByLanguages.get(this.getDefaultLang())?.values, key)
        || key;
  }

  tryGetLocalized(values, key) {
    if (!values) return null;
    return key.split(".").reduce((acc, keyPart) => acc?.[keyPart], values);
  }

  static getTranslationsByLanguages(translations) {
    const translationsByLanguage = new Map();
    for (const translation of Object.values(translations || {})) {
      translationsByLanguage.set(translation.language, translation);
    }
    return translationsByLanguage;
  }

}
