/**
 * Device abstractions provide typed, domain-specific wrappers around
 * SmartHomeEntity objects. Each device class extracts domain-specific
 * attributes and provides convenience methods.
 *
 * These are pure data objects — they don't hold a reference to a client.
 * Use them for typed attribute access and pair with service call builders
 * from utils/service-calls.ts for control.
 *
 * @example
 * ```ts
 * const entity = ha.getEntity('light.living_room');
 * const light = new Light(entity);
 *
 * console.log(light.isOn, light.brightness, light.colorTemp);
 *
 * // Build a service call to control it
 * await ha.executeServiceCall(
 *   lightTurnOn(light.entityId, { brightness: 200 })
 * );
 * ```
 */

import type {
  SmartHomeEntity,
} from '../types';

// ─── Base device ─────────────────────────────────────────────────────────────

export abstract class SmartDevice {
  readonly entityId: string;
  readonly friendlyName: string;
  readonly state: string;
  readonly attributes: Record<string, unknown>;
  readonly lastChanged: string;
  readonly lastUpdated: string;
  readonly areaId?: string;
  readonly deviceId?: string;

  constructor(entity: SmartHomeEntity) {
    this.entityId = entity.entityId;
    this.friendlyName = entity.friendlyName;
    this.state = entity.state;
    this.attributes = entity.attributes;
    this.lastChanged = entity.lastChanged;
    this.lastUpdated = entity.lastUpdated;
    this.areaId = entity.areaId;
    this.deviceId = entity.deviceId;
  }

  get isUnavailable(): boolean {
    return this.state === 'unavailable' || this.state === 'unknown';
  }

  protected attr<T>(key: string): T | undefined {
    return this.attributes[key] as T | undefined;
  }
}

// ─── Light ───────────────────────────────────────────────────────────────────

export class Light extends SmartDevice {
  get isOn(): boolean {
    return this.state === 'on';
  }

  /** 0–255 */
  get brightness(): number | undefined {
    return this.attr<number>('brightness');
  }

  /** 0–100 */
  get brightnessPercent(): number | undefined {
    const b = this.brightness;
    return b != null ? Math.round((b / 255) * 100) : undefined;
  }

  /** Mireds */
  get colorTemp(): number | undefined {
    return this.attr<number>('color_temp');
  }

  get colorTempKelvin(): number | undefined {
    return this.attr<number>('color_temp_kelvin');
  }

  /** [hue 0–360, saturation 0–100] */
  get hsColor(): [number, number] | undefined {
    return this.attr<[number, number]>('hs_color');
  }

  /** [r, g, b] each 0–255 */
  get rgbColor(): [number, number, number] | undefined {
    return this.attr<[number, number, number]>('rgb_color');
  }

  get colorMode(): string | undefined {
    return this.attr<string>('color_mode');
  }

  get supportedColorModes(): string[] {
    return this.attr<string[]>('supported_color_modes') ?? [];
  }

  get minMireds(): number | undefined {
    return this.attr<number>('min_mireds');
  }

  get maxMireds(): number | undefined {
    return this.attr<number>('max_mireds');
  }

  get effect(): string | undefined {
    return this.attr<string>('effect');
  }

  get effectList(): string[] {
    return this.attr<string[]>('effect_list') ?? [];
  }

  get supportsColor(): boolean {
    const modes = this.supportedColorModes;
    return modes.includes('hs') || modes.includes('rgb') || modes.includes('xy');
  }

  get supportsColorTemp(): boolean {
    return this.supportedColorModes.includes('color_temp');
  }

  get supportsBrightness(): boolean {
    const modes = this.supportedColorModes;
    return modes.length > 0 && !modes.every((m) => m === 'onoff');
  }
}

// ─── Climate ─────────────────────────────────────────────────────────────────

export class Climate extends SmartDevice {
  get hvacMode(): string {
    return this.state;
  }

  get currentTemperature(): number | undefined {
    return this.attr<number>('current_temperature');
  }

  get targetTemperature(): number | undefined {
    return this.attr<number>('temperature');
  }

  get targetTempHigh(): number | undefined {
    return this.attr<number>('target_temp_high');
  }

  get targetTempLow(): number | undefined {
    return this.attr<number>('target_temp_low');
  }

  get currentHumidity(): number | undefined {
    return this.attr<number>('current_humidity');
  }

  get hvacAction(): string | undefined {
    return this.attr<string>('hvac_action');
  }

  get hvacModes(): string[] {
    return this.attr<string[]>('hvac_modes') ?? [];
  }

  get fanMode(): string | undefined {
    return this.attr<string>('fan_mode');
  }

  get fanModes(): string[] {
    return this.attr<string[]>('fan_modes') ?? [];
  }

  get presetMode(): string | undefined {
    return this.attr<string>('preset_mode');
  }

  get presetModes(): string[] {
    return this.attr<string[]>('preset_modes') ?? [];
  }

  get minTemp(): number | undefined {
    return this.attr<number>('min_temp');
  }

  get maxTemp(): number | undefined {
    return this.attr<number>('max_temp');
  }

  get isHeating(): boolean {
    return this.hvacAction === 'heating';
  }

  get isCooling(): boolean {
    return this.hvacAction === 'cooling';
  }

  get isIdle(): boolean {
    return this.hvacAction === 'idle';
  }

  get isOff(): boolean {
    return this.state === 'off';
  }
}

// ─── Lock ────────────────────────────────────────────────────────────────────

export class Lock extends SmartDevice {
  get isLocked(): boolean {
    return this.state === 'locked';
  }

  get isUnlocked(): boolean {
    return this.state === 'unlocked';
  }

  get isLocking(): boolean {
    return this.state === 'locking';
  }

  get isUnlocking(): boolean {
    return this.state === 'unlocking';
  }

  get isJammed(): boolean {
    return this.state === 'jammed';
  }

  get changedBy(): string | undefined {
    return this.attr<string>('changed_by');
  }

  get codeFormat(): string | undefined {
    return this.attr<string>('code_format');
  }

  get requiresCode(): boolean {
    return this.codeFormat != null;
  }
}

// ─── Cover ───────────────────────────────────────────────────────────────────

export class Cover extends SmartDevice {
  get isOpen(): boolean {
    return this.state === 'open';
  }

  get isClosed(): boolean {
    return this.state === 'closed';
  }

  get isOpening(): boolean {
    return this.state === 'opening';
  }

  get isClosing(): boolean {
    return this.state === 'closing';
  }

  /** 0 = closed, 100 = fully open */
  get currentPosition(): number | undefined {
    return this.attr<number>('current_position');
  }

  get currentTiltPosition(): number | undefined {
    return this.attr<number>('current_tilt_position');
  }

  get deviceClass(): string | undefined {
    return this.attr<string>('device_class');
  }
}

// ─── Fan ─────────────────────────────────────────────────────────────────────

export class Fan extends SmartDevice {
  get isOn(): boolean {
    return this.state === 'on';
  }

  /** 0–100 */
  get percentage(): number | undefined {
    return this.attr<number>('percentage');
  }

  get presetMode(): string | undefined {
    return this.attr<string>('preset_mode');
  }

  get presetModes(): string[] {
    return this.attr<string[]>('preset_modes') ?? [];
  }

  get isOscillating(): boolean {
    return this.attr<boolean>('oscillating') ?? false;
  }

  get direction(): 'forward' | 'reverse' | undefined {
    return this.attr<'forward' | 'reverse'>('direction');
  }

  get percentageStep(): number {
    return this.attr<number>('percentage_step') ?? 1;
  }
}

// ─── Media Player ────────────────────────────────────────────────────────────

export class MediaPlayer extends SmartDevice {
  get isPlaying(): boolean {
    return this.state === 'playing';
  }

  get isPaused(): boolean {
    return this.state === 'paused';
  }

  get isIdle(): boolean {
    return this.state === 'idle';
  }

  get isOff(): boolean {
    return this.state === 'off';
  }

  get mediaTitle(): string | undefined {
    return this.attr<string>('media_title');
  }

  get mediaArtist(): string | undefined {
    return this.attr<string>('media_artist');
  }

  get mediaAlbum(): string | undefined {
    return this.attr<string>('media_album_name');
  }

  get mediaContentType(): string | undefined {
    return this.attr<string>('media_content_type');
  }

  get mediaDuration(): number | undefined {
    return this.attr<number>('media_duration');
  }

  get mediaPosition(): number | undefined {
    return this.attr<number>('media_position');
  }

  /** 0.0–1.0 */
  get volume(): number | undefined {
    return this.attr<number>('volume_level');
  }

  /** 0–100 */
  get volumePercent(): number | undefined {
    const v = this.volume;
    return v != null ? Math.round(v * 100) : undefined;
  }

  get isMuted(): boolean {
    return this.attr<boolean>('is_volume_muted') ?? false;
  }

  get source(): string | undefined {
    return this.attr<string>('source');
  }

  get sourceList(): string[] {
    return this.attr<string[]>('source_list') ?? [];
  }

  get shuffle(): boolean {
    return this.attr<boolean>('shuffle') ?? false;
  }

  get repeat(): 'off' | 'all' | 'one' {
    return this.attr<'off' | 'all' | 'one'>('repeat') ?? 'off';
  }
}

// ─── Vacuum ──────────────────────────────────────────────────────────────────

export class Vacuum extends SmartDevice {
  get isCleaning(): boolean {
    return this.state === 'cleaning';
  }

  get isDocked(): boolean {
    return this.state === 'docked';
  }

  get isReturning(): boolean {
    return this.state === 'returning';
  }

  get isPaused(): boolean {
    return this.state === 'paused';
  }

  get isIdle(): boolean {
    return this.state === 'idle';
  }

  get batteryLevel(): number | undefined {
    return this.attr<number>('battery_level');
  }

  get fanSpeed(): string | undefined {
    return this.attr<string>('fan_speed');
  }

  get fanSpeedList(): string[] {
    return this.attr<string[]>('fan_speed_list') ?? [];
  }

  get status(): string | undefined {
    return this.attr<string>('status');
  }
}

// ─── Alarm Control Panel ─────────────────────────────────────────────────────

export class AlarmPanel extends SmartDevice {
  get isArmedHome(): boolean {
    return this.state === 'armed_home';
  }

  get isArmedAway(): boolean {
    return this.state === 'armed_away';
  }

  get isArmedNight(): boolean {
    return this.state === 'armed_night';
  }

  get isDisarmed(): boolean {
    return this.state === 'disarmed';
  }

  get isTriggered(): boolean {
    return this.state === 'triggered';
  }

  get isPending(): boolean {
    return this.state === 'pending';
  }

  get isArming(): boolean {
    return this.state === 'arming';
  }

  get requiresCode(): boolean {
    return this.attr<boolean>('code_arm_required') ?? false;
  }

  get codeFormat(): 'number' | 'text' | undefined {
    return this.attr<'number' | 'text'>('code_format');
  }

  get changedBy(): string | undefined {
    return this.attr<string>('changed_by');
  }
}

// ─── Sensor ──────────────────────────────────────────────────────────────────

export class Sensor extends SmartDevice {
  get numericValue(): number | undefined {
    const n = parseFloat(this.state);
    return Number.isFinite(n) ? n : undefined;
  }

  get deviceClass(): string | undefined {
    return this.attr<string>('device_class');
  }

  get stateClass(): string | undefined {
    return this.attr<string>('state_class');
  }

  get unitOfMeasurement(): string | undefined {
    return this.attr<string>('unit_of_measurement');
  }

  /** Formatted state with unit (e.g., "22.5 °C"). */
  get formattedState(): string {
    const unit = this.unitOfMeasurement;
    return unit ? `${this.state} ${unit}` : this.state;
  }
}

// ─── Binary Sensor ───────────────────────────────────────────────────────────

export class BinarySensor extends SmartDevice {
  get isOn(): boolean {
    return this.state === 'on';
  }

  get isOff(): boolean {
    return this.state === 'off';
  }

  get deviceClass(): string | undefined {
    return this.attr<string>('device_class');
  }

  /** Human-readable state based on device class. */
  get displayState(): string {
    if (this.isUnavailable) return 'Unavailable';

    const cls = this.deviceClass;
    const on = this.isOn;

    switch (cls) {
      case 'door':
      case 'garage_door':
      case 'window':
      case 'opening':
        return on ? 'Open' : 'Closed';
      case 'lock':
        return on ? 'Unlocked' : 'Locked';
      case 'motion':
      case 'occupancy':
      case 'presence':
        return on ? 'Detected' : 'Clear';
      case 'moisture':
        return on ? 'Wet' : 'Dry';
      case 'smoke':
      case 'gas':
      case 'co':
        return on ? 'Detected' : 'Clear';
      case 'battery':
        return on ? 'Low' : 'Normal';
      case 'connectivity':
        return on ? 'Connected' : 'Disconnected';
      default:
        return on ? 'On' : 'Off';
    }
  }
}

// ─── Scene ──────────────────────────────────────────────────────────────────

export class Scene extends SmartDevice {
  get isActive(): boolean {
    return this.state === 'scening' || this.state === 'on';
  }
}

// ─── Weather ────────────────────────────────────────────────────────────────

export class Weather extends SmartDevice {
  get temperature(): number | undefined {
    return this.attr<number>('temperature');
  }

  get humidity(): number | undefined {
    return this.attr<number>('humidity');
  }

  get pressure(): number | undefined {
    return this.attr<number>('pressure');
  }

  get windSpeed(): number | undefined {
    return this.attr<number>('wind_speed');
  }

  get windBearing(): number | undefined {
    return this.attr<number>('wind_bearing');
  }

  /** Current weather condition (e.g., "sunny", "rainy", "cloudy") */
  get condition(): string {
    return this.state;
  }

  /** Weather forecast entries */
  get forecast(): Array<Record<string, unknown>> {
    return this.attr<Array<Record<string, unknown>>>('forecast') ?? [];
  }
}

// ─── Camera ─────────────────────────────────────────────────────────────────

export class Camera extends SmartDevice {
  get isRecording(): boolean {
    return this.state === 'recording';
  }

  get isStreaming(): boolean {
    return this.state === 'streaming';
  }

  get isIdle(): boolean {
    return this.state === 'idle';
  }

  get frontendStreamUrl(): string | undefined {
    return this.attr<string>('frontend_stream_url');
  }
}

// ─── Person ─────────────────────────────────────────────────────────────────

export class Person extends SmartDevice {
  /** Location name (e.g., "home", "work", "not_home") */
  get location(): string {
    return this.state;
  }

  get isHome(): boolean {
    return this.state === 'home';
  }

  get latitude(): number | undefined {
    return this.attr<number>('latitude');
  }

  get longitude(): number | undefined {
    return this.attr<number>('longitude');
  }

  get gpsAccuracy(): number | undefined {
    return this.attr<number>('gps_accuracy');
  }

  get source(): string | undefined {
    return this.attr<string>('source');
  }
}

// ─── Input Boolean ──────────────────────────────────────────────────────────

export class InputBoolean extends SmartDevice {
  get isOn(): boolean {
    return this.state === 'on';
  }
}

// ─── Input Number ───────────────────────────────────────────────────────────

export class InputNumber extends SmartDevice {
  get value(): number | undefined {
    const n = parseFloat(this.state);
    return Number.isFinite(n) ? n : undefined;
  }

  get min(): number | undefined {
    return this.attr<number>('min');
  }

  get max(): number | undefined {
    return this.attr<number>('max');
  }

  get step(): number | undefined {
    return this.attr<number>('step');
  }

  get mode(): 'box' | 'slider' | undefined {
    return this.attr<'box' | 'slider'>('mode');
  }
}

// ─── Input Select ───────────────────────────────────────────────────────────

export class InputSelect extends SmartDevice {
  get selectedOption(): string {
    return this.state;
  }

  get options(): string[] {
    return this.attr<string[]>('options') ?? [];
  }
}

// ─── Script ─────────────────────────────────────────────────────────────────

export class Script extends SmartDevice {
  get isRunning(): boolean {
    return this.state === 'on';
  }

  get lastTriggered(): string | undefined {
    return this.attr<string>('last_triggered');
  }
}

// ─── Factory ─────────────────────────────────────────────────────────────────

/**
 * Create a typed device wrapper from a SmartHomeEntity.
 * Returns the appropriate subclass based on domain.
 */
export function createDevice(entity: SmartHomeEntity): SmartDevice {
  switch (entity.domain) {
    case 'light':
      return new Light(entity);
    case 'climate':
      return new Climate(entity);
    case 'lock':
      return new Lock(entity);
    case 'cover':
      return new Cover(entity);
    case 'fan':
      return new Fan(entity);
    case 'media_player':
      return new MediaPlayer(entity);
    case 'vacuum':
      return new Vacuum(entity);
    case 'alarm_control_panel':
      return new AlarmPanel(entity);
    case 'binary_sensor':
      return new BinarySensor(entity);
    case 'sensor':
      return new Sensor(entity);
    case 'scene':
      return new Scene(entity);
    case 'camera':
      return new Camera(entity);
    case 'input_boolean':
      return new InputBoolean(entity);
    case 'input_number':
      return new InputNumber(entity);
    case 'input_select':
      return new InputSelect(entity);
    case 'script':
      return new Script(entity);
    default:
      // Weather/person entities match by domain string
      if (entity.entityId.startsWith('weather.')) return new Weather(entity);
      if (entity.entityId.startsWith('person.')) return new Person(entity);
      return new Sensor(entity); // Generic fallback
  }
}
