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
    return this._origin._logger;
  }

  getHass() {
    return this._origin._hass;
  }

  getDefaultLang() {
    return this.constructor._DEFAULT_LANG;
  }

  getLang() {
    return this.getHass().language || this.getLang();
  }

  localize(key) {
    return this._translationsByLanguages.get(this.getLang())?.[key]
        || this._translationsByLanguages.get(this.getDefaultLang())?.[key]
        || key;
  }

  static getTranslationsByLanguages(translations) {
    const translationsByLanguage = new Map();
    for (const translation of Object.values(translations || {})) {
      translationsByLanguage.set(translation.language, translation);
    }
    return translationsByLanguage;
  }

}
