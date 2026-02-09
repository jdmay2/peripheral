import type { ServiceCall } from '../types';

/**
 * Typed service call builders for common smart home operations.
 * Each returns a ServiceCall object ready to pass to callService().
 */

// ─── Generic ─────────────────────────────────────────────────────────────────

export function turnOn(entityId: string, data?: Record<string, unknown>): ServiceCall {
  const domain = entityId.split('.')[0]!;
  return { domain, service: 'turn_on', target: { entityId }, serviceData: data };
}

export function turnOff(entityId: string): ServiceCall {
  const domain = entityId.split('.')[0]!;
  return { domain, service: 'turn_off', target: { entityId } };
}

export function toggle(entityId: string): ServiceCall {
  const domain = entityId.split('.')[0]!;
  return { domain, service: 'toggle', target: { entityId } };
}

// ─── Light ───────────────────────────────────────────────────────────────────

export interface LightTurnOnOptions {
  brightness?: number; // 0–255
  brightnessPct?: number; // 0–100
  colorTemp?: number; // mireds
  colorTempKelvin?: number;
  hsColor?: [number, number]; // [hue 0–360, saturation 0–100]
  rgbColor?: [number, number, number];
  rgbwColor?: [number, number, number, number];
  xyColor?: [number, number];
  effect?: string;
  flash?: 'short' | 'long';
  transition?: number; // seconds
}

export function lightTurnOn(entityId: string, options?: LightTurnOnOptions): ServiceCall {
  const serviceData: Record<string, unknown> = {};
  if (options) {
    if (options.brightness != null) serviceData.brightness = options.brightness;
    if (options.brightnessPct != null) serviceData.brightness_pct = options.brightnessPct;
    if (options.colorTemp != null) serviceData.color_temp = options.colorTemp;
    if (options.colorTempKelvin != null) serviceData.color_temp_kelvin = options.colorTempKelvin;
    if (options.hsColor) serviceData.hs_color = options.hsColor;
    if (options.rgbColor) serviceData.rgb_color = options.rgbColor;
    if (options.rgbwColor) serviceData.rgbw_color = options.rgbwColor;
    if (options.xyColor) serviceData.xy_color = options.xyColor;
    if (options.effect) serviceData.effect = options.effect;
    if (options.flash) serviceData.flash = options.flash;
    if (options.transition != null) serviceData.transition = options.transition;
  }
  return { domain: 'light', service: 'turn_on', target: { entityId }, serviceData };
}

export function lightTurnOff(entityId: string, transition?: number): ServiceCall {
  return {
    domain: 'light',
    service: 'turn_off',
    target: { entityId },
    serviceData: transition != null ? { transition } : undefined,
  };
}

// ─── Climate ─────────────────────────────────────────────────────────────────

export type HvacMode = 'off' | 'heat' | 'cool' | 'heat_cool' | 'auto' | 'dry' | 'fan_only';

export function climateSetTemperature(
  entityId: string,
  temperature: number,
  hvacMode?: HvacMode,
): ServiceCall {
  const serviceData: Record<string, unknown> = { temperature };
  if (hvacMode) serviceData.hvac_mode = hvacMode;
  return { domain: 'climate', service: 'set_temperature', target: { entityId }, serviceData };
}

export function climateSetHvacMode(entityId: string, hvacMode: HvacMode): ServiceCall {
  return {
    domain: 'climate',
    service: 'set_hvac_mode',
    target: { entityId },
    serviceData: { hvac_mode: hvacMode },
  };
}

export function climateSetFanMode(entityId: string, fanMode: string): ServiceCall {
  return {
    domain: 'climate',
    service: 'set_fan_mode',
    target: { entityId },
    serviceData: { fan_mode: fanMode },
  };
}

export function climateSetPresetMode(entityId: string, presetMode: string): ServiceCall {
  return {
    domain: 'climate',
    service: 'set_preset_mode',
    target: { entityId },
    serviceData: { preset_mode: presetMode },
  };
}

// ─── Lock ────────────────────────────────────────────────────────────────────

export function lockLock(entityId: string, code?: string): ServiceCall {
  return {
    domain: 'lock',
    service: 'lock',
    target: { entityId },
    serviceData: code ? { code } : undefined,
  };
}

export function lockUnlock(entityId: string, code?: string): ServiceCall {
  return {
    domain: 'lock',
    service: 'unlock',
    target: { entityId },
    serviceData: code ? { code } : undefined,
  };
}

export function lockOpen(entityId: string, code?: string): ServiceCall {
  return {
    domain: 'lock',
    service: 'open',
    target: { entityId },
    serviceData: code ? { code } : undefined,
  };
}

// ─── Cover ───────────────────────────────────────────────────────────────────

export function coverOpen(entityId: string): ServiceCall {
  return { domain: 'cover', service: 'open_cover', target: { entityId } };
}

export function coverClose(entityId: string): ServiceCall {
  return { domain: 'cover', service: 'close_cover', target: { entityId } };
}

export function coverStop(entityId: string): ServiceCall {
  return { domain: 'cover', service: 'stop_cover', target: { entityId } };
}

export function coverSetPosition(entityId: string, position: number): ServiceCall {
  return {
    domain: 'cover',
    service: 'set_cover_position',
    target: { entityId },
    serviceData: { position },
  };
}

export function coverSetTiltPosition(entityId: string, tiltPosition: number): ServiceCall {
  return {
    domain: 'cover',
    service: 'set_cover_tilt_position',
    target: { entityId },
    serviceData: { tilt_position: tiltPosition },
  };
}

// ─── Fan ─────────────────────────────────────────────────────────────────────

export function fanSetPercentage(entityId: string, percentage: number): ServiceCall {
  return {
    domain: 'fan',
    service: 'set_percentage',
    target: { entityId },
    serviceData: { percentage },
  };
}

export function fanSetPresetMode(entityId: string, presetMode: string): ServiceCall {
  return {
    domain: 'fan',
    service: 'set_preset_mode',
    target: { entityId },
    serviceData: { preset_mode: presetMode },
  };
}

export function fanOscillate(entityId: string, oscillating: boolean): ServiceCall {
  return {
    domain: 'fan',
    service: 'oscillate',
    target: { entityId },
    serviceData: { oscillating },
  };
}

export function fanSetDirection(entityId: string, direction: 'forward' | 'reverse'): ServiceCall {
  return {
    domain: 'fan',
    service: 'set_direction',
    target: { entityId },
    serviceData: { direction },
  };
}

// ─── Media player ────────────────────────────────────────────────────────────

export function mediaPlayerPlay(entityId: string): ServiceCall {
  return { domain: 'media_player', service: 'media_play', target: { entityId } };
}

export function mediaPlayerPause(entityId: string): ServiceCall {
  return { domain: 'media_player', service: 'media_pause', target: { entityId } };
}

export function mediaPlayerStop(entityId: string): ServiceCall {
  return { domain: 'media_player', service: 'media_stop', target: { entityId } };
}

export function mediaPlayerNext(entityId: string): ServiceCall {
  return { domain: 'media_player', service: 'media_next_track', target: { entityId } };
}

export function mediaPlayerPrevious(entityId: string): ServiceCall {
  return { domain: 'media_player', service: 'media_previous_track', target: { entityId } };
}

export function mediaPlayerSetVolume(entityId: string, volumeLevel: number): ServiceCall {
  return {
    domain: 'media_player',
    service: 'volume_set',
    target: { entityId },
    serviceData: { volume_level: volumeLevel },
  };
}

export function mediaPlayerMute(entityId: string, isMuted: boolean): ServiceCall {
  return {
    domain: 'media_player',
    service: 'volume_mute',
    target: { entityId },
    serviceData: { is_volume_muted: isMuted },
  };
}

export function mediaPlayerSelectSource(entityId: string, source: string): ServiceCall {
  return {
    domain: 'media_player',
    service: 'select_source',
    target: { entityId },
    serviceData: { source },
  };
}

// ─── Vacuum ──────────────────────────────────────────────────────────────────

export function vacuumStart(entityId: string): ServiceCall {
  return { domain: 'vacuum', service: 'start', target: { entityId } };
}

export function vacuumStop(entityId: string): ServiceCall {
  return { domain: 'vacuum', service: 'stop', target: { entityId } };
}

export function vacuumPause(entityId: string): ServiceCall {
  return { domain: 'vacuum', service: 'pause', target: { entityId } };
}

export function vacuumReturnToBase(entityId: string): ServiceCall {
  return { domain: 'vacuum', service: 'return_to_base', target: { entityId } };
}

export function vacuumLocate(entityId: string): ServiceCall {
  return { domain: 'vacuum', service: 'locate', target: { entityId } };
}

export function vacuumSetFanSpeed(entityId: string, fanSpeed: string): ServiceCall {
  return {
    domain: 'vacuum',
    service: 'set_fan_speed',
    target: { entityId },
    serviceData: { fan_speed: fanSpeed },
  };
}

// ─── Alarm ───────────────────────────────────────────────────────────────────

export function alarmArmHome(entityId: string, code?: string): ServiceCall {
  return {
    domain: 'alarm_control_panel',
    service: 'alarm_arm_home',
    target: { entityId },
    serviceData: code ? { code } : undefined,
  };
}

export function alarmArmAway(entityId: string, code?: string): ServiceCall {
  return {
    domain: 'alarm_control_panel',
    service: 'alarm_arm_away',
    target: { entityId },
    serviceData: code ? { code } : undefined,
  };
}

export function alarmArmNight(entityId: string, code?: string): ServiceCall {
  return {
    domain: 'alarm_control_panel',
    service: 'alarm_arm_night',
    target: { entityId },
    serviceData: code ? { code } : undefined,
  };
}

export function alarmDisarm(entityId: string, code?: string): ServiceCall {
  return {
    domain: 'alarm_control_panel',
    service: 'alarm_disarm',
    target: { entityId },
    serviceData: code ? { code } : undefined,
  };
}

export function alarmTrigger(entityId: string): ServiceCall {
  return { domain: 'alarm_control_panel', service: 'alarm_trigger', target: { entityId } };
}

// ─── Scene / Automation / Script ─────────────────────────────────────────────

export function activateScene(entityId: string): ServiceCall {
  return { domain: 'scene', service: 'turn_on', target: { entityId } };
}

export function triggerAutomation(entityId: string): ServiceCall {
  return { domain: 'automation', service: 'trigger', target: { entityId } };
}

export function runScript(entityId: string, variables?: Record<string, unknown>): ServiceCall {
  return {
    domain: 'script',
    service: 'turn_on',
    target: { entityId },
    serviceData: variables ? { variables } : undefined,
  };
}

// ─── Notifications ──────────────────────────────────────────────────────────

export function notificationSend(
  message: string,
  options?: { title?: string; data?: Record<string, unknown> },
): ServiceCall {
  const serviceData: Record<string, unknown> = { message };
  if (options?.title) serviceData.title = options.title;
  if (options?.data) serviceData.data = options.data;
  return { domain: 'notify', service: 'notify', serviceData };
}

export function persistentNotificationCreate(
  message: string,
  options?: { title?: string; notificationId?: string },
): ServiceCall {
  const serviceData: Record<string, unknown> = { message };
  if (options?.title) serviceData.title = options.title;
  if (options?.notificationId) serviceData.notification_id = options.notificationId;
  return { domain: 'persistent_notification', service: 'create', serviceData };
}

export function persistentNotificationDismiss(notificationId: string): ServiceCall {
  return {
    domain: 'persistent_notification',
    service: 'dismiss',
    serviceData: { notification_id: notificationId },
  };
}

// ─── Input helpers ──────────────────────────────────────────────────────────

export function inputBooleanToggle(entityId: string): ServiceCall {
  return { domain: 'input_boolean', service: 'toggle', target: { entityId } };
}

export function inputBooleanTurnOn(entityId: string): ServiceCall {
  return { domain: 'input_boolean', service: 'turn_on', target: { entityId } };
}

export function inputBooleanTurnOff(entityId: string): ServiceCall {
  return { domain: 'input_boolean', service: 'turn_off', target: { entityId } };
}

export function inputNumberSetValue(entityId: string, value: number): ServiceCall {
  return {
    domain: 'input_number',
    service: 'set_value',
    target: { entityId },
    serviceData: { value },
  };
}

export function inputSelectSelectOption(entityId: string, option: string): ServiceCall {
  return {
    domain: 'input_select',
    service: 'select_option',
    target: { entityId },
    serviceData: { option },
  };
}

// ─── Script (with variables) ────────────────────────────────────────────────

export function scriptTurnOn(entityId: string, variables?: Record<string, unknown>): ServiceCall {
  return {
    domain: 'script',
    service: 'turn_on',
    target: { entityId },
    serviceData: variables ? { variables } : undefined,
  };
}
