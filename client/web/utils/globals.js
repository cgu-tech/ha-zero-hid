// Define globals constants for HA-zero-HID project
export class Globals {
  static get COMPONENT_NAME() { return '<ha_component_name>'; }
  static get DIR_RESOURCES() { return '/local/<ha_resources_domain>'; }
  static get DIR_LAYOUTS() { return `${this.DIR_RESOURCES}/layouts`; }
  static get DIR_ICONS() { return `${this.DIR_RESOURCES}/icons`; }
  static get SVG_NAMESPACE() { return "http://www.w3.org/2000/svg"; }
}

// Freeze the Globals class to prevent accidental mutation
Object.freeze(Globals);

// (Optional) Also freeze its prototype (not usually needed for static-only classes)
Object.freeze(Globals.prototype);
